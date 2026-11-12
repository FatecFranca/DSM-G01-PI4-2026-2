/*
 * Paraflow — firmware do separador de parafusos (ESP32 + célula de carga de 5 kg / HX711)
 *
 * Fluxo: sensor de comprimento (botão) → espera a peça assentar e a balança ESTABILIZAR
 *        → identifica a bitola pelo peso → move o carrossel → publica 1 evento por peça.
 *        O estoque é calculado no backend.
 *
 * Tempo real: além dos eventos, a balança publica o peso ~1x por segundo (telemetria),
 * e o site mostra a leitura ao vivo.
 *
 * Tópicos (<prefixo>/<DEVICE_ID>/...). Toda mensagem enviada carrega o DEVICE_TOKEN:
 *   evento     (publica)  {"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}
 *   telemetria (publica)  {"peso":1.07,"estavel":true,"rssi":-60,"token":"..."}
 *   status     (publica)  {"online":true,"ligado":true,"token":"..."}  retain + LWT
 *   cmd        (assina)   {"ligado":false}  ou  {"tara":true}
 *   pedido     (assina)   {"id":"...","comp":10,"bitola":"M3","qtd":20}  → posiciona a gaveta e apita
 *   alerta     (assina)   {"estoqueBaixo":true}
 *
 * Comandos pelo Serial Monitor (115200):
 *   t          zera a balança (tara)
 *   c<gramas>  calibra com um peso conhecido sobre a balança, ex.: c1000
 *   p          mostra offset e fator de calibração
 *   z          volta ao fator de calibração padrão
 *
 * Bibliotecas: PubSubClient, ArduinoJson, ESP32Servo, HX711  (veja libraries.txt)
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <HX711.h>
#include <Preferences.h>
#include "secrets.h"  // WIFI_*, MQTT_*, TOPIC_PREFIX, DEVICE_ID, DEVICE_TOKEN

// ---------- Pinos ----------
const int NUM_COMPRIMENTOS = 4;  // 5, 10, 15, 20 mm
const int NUM_BITOLAS = 3;       // M2, M3, M4
const int PINOS_COMP[NUM_COMPRIMENTOS] = {13, 14, 27, 4};
const int COMPRIMENTOS_MM[NUM_COMPRIMENTOS] = {5, 10, 15, 20};
const int PIN_HX_DT = 16;
const int PIN_HX_SCK = 17;
const int PIN_TARA = 19;         // botão: zera a balança
const int PIN_SERVO = 18;
const int LED_ALERTA = 25;
const int LED_STATUS_SEPARADOR = 26;
const int RELE_SEPARADOR = 32;   // ativo em LOW (inverta se seu módulo for ativo em HIGH)
const int BUZZER = 33;

// ---------- Tempos (ms) ----------
const unsigned long DEBOUNCE_MS = 200;
const unsigned long ASSENTAR_MS = 300;       // espera a peça assentar antes de olhar a balança
const unsigned long TIMEOUT_PESO_MS = 2500;  // se não estabilizar até aqui, a peça é rejeitada
const unsigned long AMOSTRA_MS = 100;        // uma leitura da balança a cada 100 ms
const unsigned long TELEMETRIA_MS = 1000;
const unsigned long LED_INVALIDO_MS = 1500;
const unsigned long BIPE_MS = 150;
const unsigned long RETRY_MS = 5000;

// ---------- Célula de carga (HX711) ----------
// Fator = contagens do HX711 por grama. 419,43 é o valor TEÓRICO de uma célula de 5 kg com
// sensibilidade 1 mV/V (2^23 × (5 mV / 20 mV) / 5000 g). Cada célula real difere: CALIBRE com "c<gramas>".
const float FATOR_PADRAO = 419.43f;

// Os pesos da TABELA abaixo são em gramas reais (um M3 de 10 mm pesa ~1 g). Se a balança (ou o
// controle da célula no simulador) não permitir ajuste fino de décimos de grama, use ESCALA > 1:
// a balança passa a "ver" peso × ESCALA (ex.: 100 → 1,05 g real = 105 g na balança), mas os
// eventos continuam sendo enviados em gramas reais. Com célula adequada (50–500 g), use 1.0.
const float ESCALA_PESO = 100.0f;

const float TOLERANCIA_ESTAVEL_G = 0.04f;  // variação máxima da janela (em g reais) para "estável"
const float PESO_MINIMO_G = 0.10f;         // abaixo disso não há peça no prato
const int JANELA = 6;                      // nº de amostras avaliadas para estabilidade

struct Faixa { float media; float desvio; };
const Faixa TABELA_PESO[NUM_COMPRIMENTOS][NUM_BITOLAS] = {
  /* 5mm  */ {{0.30, 0.08}, {0.55, 0.08}, {0.85, 0.10}},
  /* 10mm */ {{0.60, 0.10}, {1.05, 0.10}, {1.60, 0.12}},
  /* 15mm */ {{0.95, 0.12}, {1.60, 0.12}, {2.40, 0.15}},
  /* 20mm */ {{1.30, 0.15}, {2.20, 0.15}, {3.30, 0.18}},
};
const float K_DESVIOS = 2.0f;

// ---------- Estado ----------
WiFiClient wifi;
PubSubClient mqtt(wifi);
Servo carrossel;
HX711 balanca;
Preferences prefs;

char topicoEvento[80], topicoStatus[80], topicoTelemetria[80], topicoCmd[80], topicoAlerta[80], topicoPedido[80];
char mensagemLwt[128];

bool separadorLigado = true;
bool estoqueBaixo = false;
unsigned long ledInvalidoAte = 0;

// buzzer sem delay: N bipes
int bipesRestantes = 0;
bool bipeLigado = false;
unsigned long proximaTrocaBipe = 0;

// balança
long offsetRaw = 0;
float fatorCal = FATOR_PADRAO;
float janela[JANELA];
int idxJanela = 0, nJanela = 0;
float pesoAtualG = 0;           // peso real médio da janela (g)
unsigned long ultimaAmostra = 0, ultimaTelemetria = 0;
bool pedirTara = false;
float pedirCalibrarG = 0;

// peça
enum EstadoPeca { LIVRE, AGUARDANDO_PESO };
EstadoPeca estado = LIVRE;
int comprimentoAtual = -1;
unsigned long detectadoEm = 0, ultimaBorda = 0, ultimaBordaTara = 0;
bool anterior[NUM_COMPRIMENTOS] = {HIGH, HIGH, HIGH, HIGH};
bool anteriorTara = HIGH;

// pedido (posiciona o carrossel na gaveta pedida)
bool pedidoPendente = false;
int pedidoPosicao = 0;

unsigned long ultimaTentativaWifi = 0, ultimaTentativaMqtt = 0;

// ---------- Saídas ----------
void bipar(int n) { bipesRestantes = n; bipeLigado = false; proximaTrocaBipe = 0; }

void atualizaSaidas() {
  unsigned long agora = millis();
  if ((bipesRestantes > 0 || bipeLigado) && agora >= proximaTrocaBipe) {
    if (!bipeLigado) { bipeLigado = true; digitalWrite(BUZZER, HIGH); }
    else { bipeLigado = false; digitalWrite(BUZZER, LOW); bipesRestantes--; }
    proximaTrocaBipe = agora + BIPE_MS;
  }
  // LED acende por peça inválida OU por estoque baixo: causas independentes
  digitalWrite(LED_ALERTA, agora < ledInvalidoAte || estoqueBaixo);
}

// ---------- Balança ----------
void limpaJanela() { nJanela = 0; idxJanela = 0; }

void empurraAmostra(float gramasBalanca) {
  janela[idxJanela] = gramasBalanca;
  idxJanela = (idxJanela + 1) % JANELA;
  if (nJanela < JANELA) nJanela++;
}

float mediaJanelaG() {  // em g REAIS
  if (nJanela == 0) return 0;
  float s = 0;
  for (int i = 0; i < nJanela; i++) s += janela[i];
  return (s / nJanela) / ESCALA_PESO;
}

bool janelaEstavel() {
  if (nJanela < JANELA) return false;
  float mn = janela[0], mx = janela[0];
  for (int i = 1; i < JANELA; i++) { mn = min(mn, janela[i]); mx = max(mx, janela[i]); }
  return (mx - mn) / ESCALA_PESO <= TOLERANCIA_ESTAVEL_G;
}

// Lê sem travar o loop: só lê quando o HX711 sinaliza que há conversão pronta.
void amostraBalanca() {
  if (millis() - ultimaAmostra < AMOSTRA_MS || !balanca.is_ready()) return;
  ultimaAmostra = millis();
  long raw = balanca.read();
  empurraAmostra((raw - offsetRaw) / fatorCal);
  pesoAtualG = mediaJanelaG();
}

// Média de várias leituras (usada na tara e na calibração). Bloqueia por até ~2 s.
bool mediaRaw(long &saida) {
  long soma = 0;
  int n = 0;
  unsigned long t0 = millis();
  while (n < 10 && millis() - t0 < 2000) {
    if (balanca.is_ready()) { soma += balanca.read(); n++; }
    delay(5);
  }
  if (n == 0) return false;
  saida = soma / n;
  return true;
}

void tararBalanca() {
  long m;
  if (mediaRaw(m)) { offsetRaw = m; limpaJanela(); Serial.printf("Tara ok (offset=%ld)\n", offsetRaw); }
  else Serial.println("Tara falhou: HX711 nao respondeu (confira DT/SCK/VCC/GND).");
}

void calibrarBalanca(float gramasConhecidos) {
  long m;
  if (!mediaRaw(m)) { Serial.println("Calibracao falhou: HX711 nao respondeu."); return; }
  float novo = (m - offsetRaw) / gramasConhecidos;
  if (fabsf(novo) < 1.0f) { Serial.println("Calibracao invalida: coloque o peso conhecido sobre a balanca."); return; }
  fatorCal = novo;
  prefs.putFloat("fator", fatorCal);
  limpaJanela();
  Serial.printf("Calibrado: fator=%.2f contagens/g (salvo)\n", fatorCal);
}

void executaComandoSerial(String l) {
  l.trim();
  if (l == "t") pedirTara = true;
  else if (l.startsWith("c")) {
    float g = l.substring(1).toFloat();
    if (g > 0) pedirCalibrarG = g; else Serial.println("uso: c<gramas>, ex.: c1000");
  } else if (l == "p") {
    Serial.printf("offset=%ld fator=%.2f escala=%.1f peso=%.2f g\n", offsetRaw, fatorCal, ESCALA_PESO, pesoAtualG);
  } else if (l == "z") {
    fatorCal = FATOR_PADRAO; prefs.remove("fator"); Serial.println("Fator padrao restaurado.");
  }
}

void processaSerial() {
  static String linha;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { if (linha.length()) executaComandoSerial(linha); linha = ""; }
    else if (linha.length() < 20) linha += c;
  }
}

// ---------- MQTT ----------
void publicaStatus(bool online = true) {
  char buf[128];
  snprintf(buf, sizeof(buf), "{\"online\":%s,\"ligado\":%s,\"token\":\"%s\"}",
           online ? "true" : "false", separadorLigado ? "true" : "false", DEVICE_TOKEN);
  mqtt.publish(topicoStatus, buf, true);  // retain
}

void aplicaSeparador(bool ligado) {
  separadorLigado = ligado;
  digitalWrite(RELE_SEPARADOR, ligado ? LOW : HIGH);
  digitalWrite(LED_STATUS_SEPARADOR, ligado ? HIGH : LOW);
  if (!ligado) estado = LIVRE;
  if (mqtt.connected()) publicaStatus();
}

// Gaveta do carrossel: mesma conta do backend (comprimento × bitola, 15° cada).
bool posicaoDaGaveta(int comp, const char* bitola, int &posicao) {
  int ic = -1;
  for (int i = 0; i < NUM_COMPRIMENTOS; i++) if (COMPRIMENTOS_MM[i] == comp) ic = i;
  int ib = (bitola && bitola[0] == 'M') ? atoi(bitola + 1) - 2 : -1;
  if (ic < 0 || ib < 0 || ib >= NUM_BITOLAS) return false;
  posicao = (ic * NUM_BITOLAS + ib) * 15;
  return true;
}

void aoReceber(char* topico, byte* payload, unsigned int tam) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, tam)) return;

  if (strcmp(topico, topicoCmd) == 0) {
    if (doc["ligado"].is<bool>()) aplicaSeparador(doc["ligado"].as<bool>());
    if (doc["tara"].is<bool>() && doc["tara"].as<bool>()) pedirTara = true;
  } else if (strcmp(topico, topicoAlerta) == 0) {
    if (doc["estoqueBaixo"].is<bool>()) estoqueBaixo = doc["estoqueBaixo"].as<bool>();
  } else if (strcmp(topico, topicoPedido) == 0) {
    int pos;
    if (posicaoDaGaveta(doc["comp"] | 0, doc["bitola"] | "", pos)) {
      pedidoPosicao = pos;
      pedidoPendente = true;  // aplicado quando nenhuma peça estiver sendo medida
      Serial.printf("Pedido: %d x %s %d mm\n", (int)(doc["qtd"] | 0), (const char*)(doc["bitola"] | "?"), (int)(doc["comp"] | 0));
    }
  }
}

void publicaEvento(int comp, int bitola, float pesoG, bool valido) {
  if (!mqtt.connected()) {
    Serial.println("MQTT offline: evento nao enviado");  // TODO: fila em memoria/SPIFFS
    return;
  }
  char buf[192];
  if (valido) {
    snprintf(buf, sizeof(buf), "{\"comp\":%d,\"bitola\":\"M%d\",\"peso\":%.2f,\"valido\":true,\"token\":\"%s\"}",
             comp, bitola + 2, pesoG, DEVICE_TOKEN);
  } else {
    snprintf(buf, sizeof(buf), "{\"comp\":%d,\"bitola\":null,\"peso\":%.2f,\"valido\":false,\"token\":\"%s\"}",
             comp, pesoG, DEVICE_TOKEN);
  }
  mqtt.publish(topicoEvento, buf);
}

void publicaTelemetria() {
  if (!mqtt.connected() || millis() - ultimaTelemetria < TELEMETRIA_MS) return;
  ultimaTelemetria = millis();
  char buf[160];
  snprintf(buf, sizeof(buf), "{\"peso\":%.2f,\"estavel\":%s,\"rssi\":%d,\"token\":\"%s\"}",
           pesoAtualG, janelaEstavel() ? "true" : "false", WiFi.RSSI(), DEVICE_TOKEN);
  mqtt.publish(topicoTelemetria, buf);  // não retida: é leitura ao vivo
}

void mantemConexoes() {
  unsigned long agora = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (agora - ultimaTentativaWifi > RETRY_MS) {
      ultimaTentativaWifi = agora;
      Serial.println("Wi-Fi desconectado, tentando de novo...");
      WiFi.reconnect();
    }
    return;
  }

  if (!mqtt.connected()) {
    // a 1ª tentativa é imediata; as seguintes respeitam o intervalo
    if (ultimaTentativaMqtt != 0 && agora - ultimaTentativaMqtt < RETRY_MS) return;
    ultimaTentativaMqtt = agora ? agora : 1;

    Serial.printf("Wi-Fi ok (%s). Conectando MQTT em %s:%d ...\n", WiFi.localIP().toString().c_str(), MQTT_HOST, MQTT_PORT);
    String clientId = String("paraflow-") + DEVICE_ID;
    const char* user = strlen(MQTT_USER) ? MQTT_USER : nullptr;
    const char* pass = strlen(MQTT_USER) ? MQTT_PASS : nullptr;
    // Last Will: se o ESP32 cair, o broker publica online:false (com o token, senão o backend descarta)
    if (mqtt.connect(clientId.c_str(), user, pass, topicoStatus, 1, true, mensagemLwt)) {
      mqtt.subscribe(topicoCmd, 1);
      mqtt.subscribe(topicoAlerta, 1);
      mqtt.subscribe(topicoPedido, 1);
      publicaStatus();
      Serial.println("MQTT conectado!");
    } else {
      Serial.printf("MQTT falhou, codigo=%d\n", mqtt.state());
    }
  }
  mqtt.loop();
}

// ---------- Sensores de comprimento ----------
// Detecta a BORDA (solto → pressionado): segurar o botão não conta a peça de novo.
int detectaComprimento() {
  int achado = -1;
  for (int i = 0; i < NUM_COMPRIMENTOS; i++) {
    bool atual = digitalRead(PINOS_COMP[i]);
    if (anterior[i] == HIGH && atual == LOW && achado < 0 && millis() - ultimaBorda > DEBOUNCE_MS) {
      achado = i;
      ultimaBorda = millis();
    }
    anterior[i] = atual;
  }
  return achado;
}

void verificaBotaoTara() {
  bool atual = digitalRead(PIN_TARA);
  if (anteriorTara == HIGH && atual == LOW && millis() - ultimaBordaTara > DEBOUNCE_MS) {
    ultimaBordaTara = millis();
    pedirTara = true;
  }
  anteriorTara = atual;
}

int identificaBitola(int idxComp, float pesoG) {
  float melhorDist = 1e9f;
  int escolhida = -1;
  for (int b = 0; b < NUM_BITOLAS; b++) {
    float dist = fabsf(pesoG - TABELA_PESO[idxComp][b].media);
    float limite = K_DESVIOS * TABELA_PESO[idxComp][b].desvio;
    if (dist <= limite && dist < melhorDist) { melhorDist = dist; escolhida = b; }
  }
  return escolhida;  // -1 = inválida
}

void moverCarrossel(int idxComp, int bitola) { carrossel.write((idxComp * NUM_BITOLAS + bitola) * 15); }

// ---------- Máquina de estados: 1 peça por vez ----------
void finalizaPeca(float pesoG, bool estavel) {
  int comp = COMPRIMENTOS_MM[comprimentoAtual];
  int bitola = (estavel && pesoG >= PESO_MINIMO_G) ? identificaBitola(comprimentoAtual, pesoG) : -1;

  if (bitola >= 0) {
    moverCarrossel(comprimentoAtual, bitola);
    publicaEvento(comp, bitola, pesoG, true);
  } else {
    ledInvalidoAte = millis() + LED_INVALIDO_MS;
    bipar(1);
    carrossel.write(180);  // posição de descarte
    publicaEvento(comp, -1, pesoG, false);
    Serial.printf("Peca rejeitada (%.2f g, %s)\n", pesoG, estavel ? "fora da faixa" : "leitura instavel");
  }
  estado = LIVRE;
}

void processaPeca() {
  if (estado == LIVRE) {
    int c = detectaComprimento();
    if (c < 0) return;
    comprimentoAtual = c;
    detectadoEm = millis();
    limpaJanela();  // descarta leituras de antes da peça assentar
    estado = AGUARDANDO_PESO;
    return;
  }

  unsigned long decorrido = millis() - detectadoEm;
  if (decorrido < ASSENTAR_MS) return;

  if (janelaEstavel()) finalizaPeca(mediaJanelaG(), true);
  else if (decorrido > TIMEOUT_PESO_MS) finalizaPeca(mediaJanelaG(), false);  // não estabilizou: rejeita
}

// Tarefas que mexem na balança/carrossel só rodam com o prato livre (nenhuma peça sendo medida).
void tarefasPendentes() {
  if (estado != LIVRE) return;
  if (pedirTara) { pedirTara = false; tararBalanca(); }
  if (pedirCalibrarG > 0) { float g = pedirCalibrarG; pedirCalibrarG = 0; calibrarBalanca(g); }
  if (pedidoPendente) {
    pedidoPendente = false;
    carrossel.write(pedidoPosicao);
    bipar(2);
  }
}

// ---------- Arduino ----------
void setup() {
  Serial.begin(115200);

  for (int i = 0; i < NUM_COMPRIMENTOS; i++) pinMode(PINOS_COMP[i], INPUT_PULLUP);
  pinMode(PIN_TARA, INPUT_PULLUP);
  pinMode(LED_ALERTA, OUTPUT);
  pinMode(LED_STATUS_SEPARADOR, OUTPUT);
  pinMode(RELE_SEPARADOR, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  carrossel.attach(PIN_SERVO);
  aplicaSeparador(true);

  prefs.begin("paraflow", false);
  fatorCal = prefs.getFloat("fator", FATOR_PADRAO);
  balanca.begin(PIN_HX_DT, PIN_HX_SCK);
  Serial.printf("Balanca HX711 (fator=%.2f, escala=%.1f). Aguardando o sensor...\n", fatorCal, ESCALA_PESO);
  tararBalanca();  // assume o prato vazio ao ligar

  snprintf(topicoEvento, sizeof(topicoEvento), "%s/%s/evento", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoStatus, sizeof(topicoStatus), "%s/%s/status", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoTelemetria, sizeof(topicoTelemetria), "%s/%s/telemetria", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoCmd, sizeof(topicoCmd), "%s/%s/cmd", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoAlerta, sizeof(topicoAlerta), "%s/%s/alerta", TOPIC_PREFIX, DEVICE_ID);
  snprintf(topicoPedido, sizeof(topicoPedido), "%s/%s/pedido", TOPIC_PREFIX, DEVICE_ID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);  // canal 6 acelera a conexão no Wokwi
  snprintf(mensagemLwt, sizeof(mensagemLwt), "{\"online\":false,\"token\":\"%s\"}", DEVICE_TOKEN);
  mqtt.setBufferSize(512);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(aoReceber);
}

void loop() {
  mantemConexoes();
  processaSerial();
  verificaBotaoTara();
  amostraBalanca();
  publicaTelemetria();
  atualizaSaidas();
  tarefasPendentes();
  if (!separadorLigado) return;
  processaPeca();
}
