#define BLYNK_TEMPLATE_ID "TMPL2xBEkZ_gL"
#define BLYNK_TEMPLATE_NAME "ParaFlow"
#define BLYNK_AUTH_TOKEN "60EDSlTSZEdzIyevHExKu2yr-wq9FoWB"
#define BLYNK_PRINT Serial

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <ESP32Servo.h>

// --- Pinos ---
const int PIN_5MM  = 13;
const int PIN_10MM = 14;
const int PIN_15MM = 27;
const int PIN_20MM = 4;   
const int PIN_PESO  = 34;
const int PIN_SERVO = 18;
const int LED_ALERTA = 25;
const int LED_STATUS_SEPARADOR = 26; // indica visualmente ligado/desligado
const int RELE_SEPARADOR = 32;       // ativo em LOW (ajuste se seu módulo for ativo em HIGH)
const int BUZZER = 33;

// --- Estado geral ---
Servo carrossel;
bool separadorLigado = true;
const int NUM_COMPRIMENTOS = 4; // 5, 10, 15, 20 mm
const int NUM_BITOLAS = 3;      // M2, M3, M4
int estoque[NUM_COMPRIMENTOS][NUM_BITOLAS];
const int LIMITE_BAIXO = 5;
const int comprimentosMM[NUM_COMPRIMENTOS] = {5, 10, 15, 20};

// --- Calibração estatística: média/desvio de peso por (comprimento x bitola) ---
struct Faixa { float media; float desvio; };
Faixa tabelaPeso[NUM_COMPRIMENTOS][NUM_BITOLAS] = {
  /* 5mm  */ {{0.30,0.08},{0.55,0.08},{0.85,0.10}},
  /* 10mm */ {{0.60,0.10},{1.05,0.10},{1.60,0.12}},
  /* 15mm */ {{0.95,0.12},{1.60,0.12},{2.40,0.15}},
  /* 20mm */ {{1.30,0.15},{2.20,0.15},{3.30,0.18}}
};
const float K_DESVIOS = 2.0; // limite de outlier (2 desvios-padrão)

// --- Máquina de estados: garante 1 peça por vez (singulação) ---
enum EstadoPeca { LIVRE, AGUARDANDO_PESO };
EstadoPeca estado = LIVRE;
int comprimentoAtual = -1;

BLYNK_WRITE(V7) {
  separadorLigado = param.asInt();
  digitalWrite(RELE_SEPARADOR, separadorLigado ? LOW : HIGH);     // ativo em LOW
  digitalWrite(LED_STATUS_SEPARADOR, separadorLigado ? HIGH : LOW); // indicador visual
}

int identificaBitola(int idxComp, float peso, bool &valido) {
  float melhorDist = 999;
  int bitolaEscolhida = -1;
  for (int b = 0; b < NUM_BITOLAS; b++) {
    float dist = abs(peso - tabelaPeso[idxComp][b].media);
    float limite = K_DESVIOS * tabelaPeso[idxComp][b].desvio;
    if (dist <= limite && dist < melhorDist) {
      melhorDist = dist;
      bitolaEscolhida = b;
    }
  }
  valido = (bitolaEscolhida != -1);
  return bitolaEscolhida;
}

void moverCarrossel(int idxComp, int bitola) {
  int posicao = (idxComp * NUM_BITOLAS + bitola) * 15; // 12 posições, 15° cada
  carrossel.write(posicao);
  Blynk.virtualWrite(V8, posicao);
}

void atualizaEstoqueBlynk() {
  int totalM2 = 0, totalM3 = 0, totalM4 = 0;
  for (int c = 0; c < NUM_COMPRIMENTOS; c++) {
    totalM2 += estoque[c][0];
    totalM3 += estoque[c][1];
    totalM4 += estoque[c][2];
  }
  Blynk.virtualWrite(V3, totalM2);
  Blynk.virtualWrite(V4, totalM3);
  Blynk.virtualWrite(V5, totalM4);

  bool baixo = totalM2 < LIMITE_BAIXO || totalM3 < LIMITE_BAIXO || totalM4 < LIMITE_BAIXO;
  digitalWrite(LED_ALERTA, baixo);
  Blynk.virtualWrite(V6, baixo);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_5MM, INPUT_PULLUP);
  pinMode(PIN_10MM, INPUT_PULLUP);
  pinMode(PIN_15MM, INPUT_PULLUP);
  pinMode(PIN_20MM, INPUT_PULLUP);
  pinMode(LED_ALERTA, OUTPUT);
  pinMode(LED_STATUS_SEPARADOR, OUTPUT);
  pinMode(RELE_SEPARADOR, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(RELE_SEPARADOR, LOW);          // começa ligado (ativo em LOW)
  digitalWrite(LED_STATUS_SEPARADOR, HIGH);   // LED aceso = separador ligado
  carrossel.attach(PIN_SERVO);

  memset(estoque, 0, sizeof(estoque));
  Blynk.begin(BLYNK_AUTH_TOKEN, "Wokwi-GUEST", "");
}

void loop() {
  Blynk.run();
  if (!separadorLigado) return;

  if (estado == LIVRE) {
    if (digitalRead(PIN_5MM) == LOW)       comprimentoAtual = 0;
    else if (digitalRead(PIN_10MM) == LOW) comprimentoAtual = 1;
    else if (digitalRead(PIN_15MM) == LOW) comprimentoAtual = 2;
    else if (digitalRead(PIN_20MM) == LOW) comprimentoAtual = 3;
    else return;

    estado = AGUARDANDO_PESO;
    Blynk.virtualWrite(V1, comprimentosMM[comprimentoAtual]);
    delay(300);
  }

  if (estado == AGUARDANDO_PESO) {
    float peso = analogRead(PIN_PESO) * 5.0 / 4095.0;
    Blynk.virtualWrite(V0, peso);

    bool valido;
    int bitola = identificaBitola(comprimentoAtual, peso, valido);

    if (valido) {
      estoque[comprimentoAtual][bitola]++;
      Blynk.virtualWrite(V2, bitola);
      moverCarrossel(comprimentoAtual, bitola);
    } else {
      digitalWrite(LED_ALERTA, HIGH);
      digitalWrite(BUZZER, HIGH);
      delay(150);
      digitalWrite(BUZZER, LOW);
      carrossel.write(180);
    }

    atualizaEstoqueBlynk();
    estado = LIVRE;
  }
}