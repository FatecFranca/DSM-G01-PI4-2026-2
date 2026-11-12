# Arquitetura

## Fluxo de dados
1. O ESP32 detecta o comprimento (sensor), pesa a peça, identifica a bitola pela tabela de peso e move o carrossel.
2. Publica `{"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}` em `<prefixo>/<deviceId>/evento`.
3. O backend assina `<prefixo>/+/evento`, confere deviceId + token (descobrindo a organização da máquina), valida com zod, grava o evento com o `organizacaoId` e recalcula o estoque dessa organização.
4. O backend emite `estoque:atualizado` por Socket.IO só para a sala da organização e publica `alerta` de volta às máquinas dela (LED).
5. Comandos do operador: `POST /api/dispositivo/comando` → backend publica em `<prefixo>/<deviceId>/cmd` → ESP32 aplica e responde com `status`.

## Decisões
- **Estoque derivado dos eventos** (agregação no MongoDB): sem contador duplicado, reiniciar o ESP32 não perde nada, e o histórico por dia vem de graça.
- **Barramento interno** (`utils/bus.js`): `estoque.service` e `dispositivo.service` emitem eventos; `sockets/` e `mqtt.service` só ouvem. Evita dependência circular.
- **Multi-organização**: `Usuario`, `Dispositivo`, `Evento` e `Config` guardam `organizacaoId`. O id vem do usuário autenticado (ou da máquina autenticada no MQTT), nunca do corpo do pedido. O WebSocket usa uma sala por organização.
- **Estoque = entradas − pedidos**: a contagem do ESP32 gera entradas; cada pedido não cancelado reserva peças na hora. Cancelar devolve. Dois pedidos simultâneos são serializados por organização para o estoque nunca ficar negativo (vale para uma instância do backend; com várias, use transação ou lock no banco).
- **Telemetria ao vivo**: o peso da balança passa pelo backend só em memória (MQTT → WebSocket), sem gravar no banco.
- **Papéis** (`dono` / `operador`): o papel é lido do banco a cada requisição, então promover, rebaixar ou remover vale imediatamente, sem relogar. Operador consulta e liga/desliga a máquina; dono também gerencia máquinas, regras e equipe.
- **Convites**: código aleatório de uso único, validade configurável, guardado só em hash e consumido de forma atômica (duas pessoas não usam o mesmo código; se o cadastro falha, o convite volta).
- **Máquina = deviceId + token**: o servidor gera ambos ao vincular a máquina; só o hash SHA-256 do token fica no banco.
- **Servidor decide a sessão**: `GET /auth/me` e o middleware `autenticar` conferem o JWT *e* a existência do usuário no banco; o WebSocket faz o mesmo no handshake.
- **Alerta de estoque baixo** só dispara depois da primeira peça contada, e o limite vem da coleção `configs` (não está fixo no firmware).

## Coleções MongoDB
| Coleção | Campos principais |
|---|---|
| `organizacoes` | nome |
| `usuarios` | organizacaoId, nome, usuario (único), email (único), senhaHash, papel (`dono`/`operador`) |
| `convites` | organizacaoId, codigoHash (único), papel, expiraEm, usadoEm, usadoPor |
| `pedidos` | organizacaoId, solicitanteId/Nome, bitola, comprimentoMm, quantidade, status (`aberto`/`retirado`/`cancelado`), deviceId |
| `dispositivos` | organizacaoId, deviceId (único), nome, tokenHash, ligado, online, ultimoContato |
| `eventos` | organizacaoId, deviceId, comprimentoMm, bitola, peso, valido, ocorridoEm |
| `configs` | organizacaoId (único), limiteBaixo, kDesvios, comprimentosMm, bitolas, tabelaPeso |
