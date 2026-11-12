# IoT (ESP32 + célula de carga de 5 kg)

Firmware do separador. Publica **um evento JSON por peça** e a **leitura ao vivo da balança**; o estoque é calculado no backend.

## Arquivos
- `sketch.ino`: firmware (HX711, MQTT, estabilização da balança, tara, calibração, pedidos)
- `diagram.json`: circuito do Wokwi (ESP32 + HX711 de 5 kg + 4 botões de comprimento + botão de tara + servo + relé + LEDs + buzzer)
- `libraries.txt`: PubSubClient, ArduinoJson, ESP32Servo, HX711
- `secrets.example.h`: modelo de credenciais → copie para `secrets.h` (ignorado pelo git)
- `wokwi-project.txt`: mantenha o seu atual

## Vincular a máquina à sua organização
No site: **Configurações → Máquinas → Adicionar máquina**. Copie `DEVICE_ID` e `DEVICE_TOKEN` (o token aparece uma vez) para o `secrets.h`. O backend só aceita mensagens de máquinas com `deviceId` + token válidos.

## Simular no Wokwi
1. Substitua o `diagram.json`, o `sketch.ino` e o `libraries.txt` do projeto Wokwi pelos desta pasta e crie o `secrets.h`.
2. Use um broker que o backend também alcance (ex.: `broker.hivemq.com` com **prefixo único**, igual em `TOPIC_PREFIX` e `MQTT_TOPIC_PREFIX`).
3. **Botões 5/10/15/20 mm** = sensores de comprimento. **Célula de carga:** ajuste o peso no controle da própria célula. Com `ESCALA_PESO = 100`, a balança "vê" 100× o peso real: **105 g na célula = 1,05 g real (M3 de 10 mm)**. O botão branco zera a balança (tara).
4. Entre as peças, volte o peso para perto de 0 se quiser, mas não é obrigatório: cada peça é medida quando você aperta o botão de comprimento e a leitura estabiliza.

### O que mudou em relação ao potenciômetro
- **Estabilização:** a peça só é classificada quando a leitura fica estável (janela de 6 amostras, tolerância 0,04 g). Se não estabilizar em 2,5 s, é **rejeitada**.
- **Balança ao vivo:** o peso é enviado ~1x/s (`telemetria`) e aparece no dashboard.
- **Tara:** botão no circuito, comando `t` no Serial ou botão "Zerar balança" no site. A balança também é zerada ao ligar (prato vazio).
- **Pedido de parafusos:** quando alguém faz um pedido no site/app, o carrossel gira para a gaveta daquele tipo e o buzzer apita 2x.
- **Correção no circuito:** o diagrama antigo **não ligava o sinal do servo** (faltava `servo1:PWM → esp:18`); agora está ligado.

## Calibração (importante)
O fator padrão (`419,43` contagens/g) é o valor **teórico** de uma célula de 5 kg de 1 mV/V. Cada célula real difere, então calibre:
1. Abra o Serial Monitor (115200), deixe o prato **vazio** e envie `t`.
2. Coloque um peso conhecido (ex.: 1000 g) e envie `c1000`. O fator é calculado e **salvo** na memória do ESP32.
3. `p` mostra o offset e o fator; `z` volta ao padrão.

> **Atenção ao hardware real:** uma célula de **5 kg tem resolução de cerca de 1 g**, e os parafusos do projeto (M2–M4, 5–20 mm) pesam **0,3 a 3,3 g**, a mesma ordem de grandeza do ruído. No simulador funciona porque ele é ideal. Na montagem física use uma célula de **50 a 500 g** (ou pese vários parafusos de uma vez). Esse é o "ponto crítico: identificação por peso" do briefing.

## Comandos pelo Serial
| Comando | O que faz |
|---|---|
| `t` | Zera a balança (tara) |
| `c<gramas>` | Calibra com um peso conhecido, ex.: `c1000` |
| `p` | Mostra offset, fator, escala e peso atual |
| `z` | Restaura o fator padrão |

## Segurança
O token do Blynk que existia no `sketch.ino` original foi removido. **Revogue-o no Blynk.** Nunca commite o `secrets.h`.
