# Paraflow

Projeto Integrador. Sistema que separa, conta e controla o estoque de parafusos por bitola e comprimento. Um ESP32 mede cada peça e manda os dados por MQTT para um servidor, que guarda tudo no MongoDB e mostra o estoque em tempo real no site e no app.

## Integrantes

- Guilherme Barbosa B. Campos
- Cauã Henrique Nascimento
- Gabriel Henrique Ferreira
- Rodrigo Avelar Santos

## O que o sistema faz

- Separa e conta cada parafuso (comprimento pelo sensor, bitola pelo peso na célula de carga).
- Mostra o estoque atualizado na hora, junto com o peso da balança ao vivo.
- Cada empresa tem a sua conta: usuários, máquinas, estoque e pedidos são separados entre empresas.
- O dono da empresa cadastra máquinas e convida ou cria usuários (dono ou operador).
- Qualquer usuário pode fazer um pedido de parafusos (tipo, comprimento e quantidade). As peças saem do estoque e a máquina gira o carrossel até a gaveta certa.
- O dashboard mostra o parafuso com menos estoque, a média de peças contadas por dia, gráficos dos últimos 14 dias e uma previsão dos próximos pedidos.

## Como funciona

```
ESP32 (sensores, balança, servo)
   |  MQTT: um evento por peça, peso ao vivo
   v
Broker MQTT (Mosquitto)
   |
   v
Backend (Node + Express) ---- MongoDB
   |  REST em /api e WebSocket (Socket.IO)
   +--> Web (React + Vite)
   +--> Mobile (Expo)
```

O estoque não é um contador: é calculado a partir das peças gravadas no banco menos os pedidos. Por isso reiniciar o ESP32 não zera nada.

## Pastas

- `backend/`: API em Node (rotas em `src/routes`, regras em `src/services`)
- `web/`: site em React
- `mobile/`: app em Expo
- `iot/`: firmware do ESP32 e circuito do Wokwi
- `docs/`: briefing, arquitetura e lista de rotas
- `infra/`: configuração do Mosquitto usada pelo `docker-compose.yml`

## Como rodar

Precisa de Node 22.13 ou mais novo e do Docker (para o MongoDB e o Mosquitto locais).

```bash
npm install
npm run infra:up

cp backend/.env.example backend/.env    # troque o JWT_SECRET
npm run dev:backend                     # http://localhost:3333/api/health
npm run dev:web                         # http://localhost:5173
```

Sem Docker, use o MongoDB Atlas e um broker público: coloque a string do Atlas em `MONGO_URI` e `mqtt://broker.hivemq.com:1883` em `MQTT_URL`. Em broker público, troque o `MQTT_TOPIC_PREFIX` por um nome só seu.

O app (Expo):

```bash
cd mobile
cp .env.example .env     # coloque o IP do seu computador em EXPO_PUBLIC_API_URL
npm install
npx expo install --fix
npm run start
```

Ao atualizar o projeto, preserve o banco existente e revise mudanças de dados antes de executar migrações.

## Primeiros passos no sistema

1. Cadastre-se informando o nome da empresa. Você vira o dono.
2. Em Configurações, adicione uma máquina. O código e o token aparecem uma vez só.
3. Para testar sem o ESP32: `npm run simular -- <deviceId> <token>`. O estoque sobe no dashboard.
4. Em Equipe, gere um código de convite ou crie um usuário. Quem usa o convite entra na sua empresa.
5. Em Pedidos, peça parafusos. O dashboard mostra a previsão depois dos primeiros pedidos.

Para usar o ESP32 (ou o Wokwi), veja `iot/README.md`.

## Papéis

O dono pode tudo: máquinas, regras de estoque e equipe. O operador consulta o estoque, faz pedidos e liga ou desliga a máquina.

## Observações

- Uma célula de carga de 5 kg tem resolução de cerca de 1 g, e os parafusos pesam de 0,3 a 3,3 g. No simulador funciona, mas na montagem real é preciso uma célula de 50 a 500 g.
- No broker público o token da máquina trafega sem criptografia. Em produção, use TLS e usuário e senha no broker.
- Os pedidos saem direto do estoque, sem aprovação do dono.
- Nunca suba para o GitHub os arquivos `.env` e `iot/secrets.h`. Cada pasta tem um arquivo de exemplo.

## Próximos passos

- Editar a tabela de peso pelo site
- Recuperação de senha
- Fila de envio no firmware para quando o MQTT cair
- Ampliar os testes automatizados e os ensaios físicos

## Dashboard e build

O dashboard mostra média e desvio padrão populacional das peças válidas dos últimos 14 dias, incluindo dias sem contagem e hoje ainda em andamento. Também permite escolher a máquina da balança e distingue reservas de retiradas confirmadas.

```bash
npm run build
```

O build gera o site em `web/dist`. Em produção, `npm start` serve o site e a API juntos. Para simular contagens durante o desenvolvimento sem o ESP32, use o comando `npm run simular` descrito acima.