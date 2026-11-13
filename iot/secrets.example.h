#pragma once
// copie este arquivo para secrets.h (ele está no .gitignore) e ajuste os valores

#define WIFI_SSID "Wokwi-GUEST"   // no Wokwi use exatamente isto
#define WIFI_PASS ""

// o Wokwi não enxerga o localhost do seu computador: use um broker público ou um túnel
#define MQTT_HOST "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASS ""

// identidade da máquina: gere no site em Configurações > Máquinas > Adicionar máquina.
// o token aparece uma vez só e liga esta máquina à sua empresa
#define DEVICE_ID    "pf-00000000"
#define DEVICE_TOKEN "00000000000000000000000000000000"

// igual ao MQTT_TOPIC_PREFIX do backend/.env. em broker público use um nome só seu
// (ex.: "paraflow-turma3b-x9k2"), senão qualquer um mexe no seu estoque
#define TOPIC_PREFIX "paraflow"
