#pragma once
// Copie para secrets.h (que está no .gitignore) e ajuste. NUNCA commite o secrets.h.

#define WIFI_SSID "Wokwi-GUEST"   // no Wokwi use exatamente isto
#define WIFI_PASS ""

// Broker MQTT. Wokwi não enxerga seu localhost: use um broker público ou um túnel.
#define MQTT_HOST "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASS ""

// Identidade da máquina: gere em  Site → Configurações → Máquinas → Adicionar máquina.
// O token aparece UMA vez e liga esta máquina à SUA organização. Não compartilhe.
#define DEVICE_ID    "pf-00000000"
#define DEVICE_TOKEN "00000000000000000000000000000000"

// Precisa ser IGUAL ao MQTT_TOPIC_PREFIX do backend/.env.
// Em broker público, use um prefixo único (ex.: "paraflow-turma3b-x9k2") para ninguém mexer no seu estoque.
#define TOPIC_PREFIX "paraflow"
