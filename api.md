# API

Base: `http://localhost:3333/api`. Rotas protegidas exigem `Authorization: Bearer <jwt>`.
Erros: `{ "erro": "texto", "codigo": "CODIGO", "campos": { "campo": "mensagem" } }`.

**Multi-organização:** cada usuário pertence a UMA organização e só enxerga os dados dela (estoque, eventos, config, máquinas). O `organizacaoId` vem sempre do usuário autenticado, nunca do pedido.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Estado do banco e do MQTT |
| POST | `/auth/register` | pública | `{nome, usuario, email, senha}` + **um** destes: `organizacao` (cria a empresa; vira **dono**) ou `codigoConvite` (entra na empresa com o papel do convite). Retorna `{token, usuario}` |
| GET | `/auth/convite/:codigo` | pública | `{organizacao, papel}`: mostra a empresa do convite sem consumi-lo |
| POST | `/auth/login` | pública | `{identificador, senha}` (usuário **ou** e-mail) → `{token, usuario}` |
| GET | `/auth/me` | token | Confirma a sessão no servidor |
| GET | `/auth/disponibilidade?usuario=&email=` | pública | `{usuario: true, email: false}` (true = livre) |
| GET | `/estoque` | token | Estoque **atual** (entradas − pedidos não cancelados): itens comprimento×bitola (`quantidade`, `entradas`, `retirados`), totais, alertas e `menorEstoque`/`menores` (tipos com menos peças, só entre os já contados) |
| GET | `/estoque/estatisticas` | token | `hoje`, `mediaPorDia` (nos dias com contagem), `mediaUltimos7Dias` (total ÷ 7), `ultimos7Dias[]`, `taxaRejeicao`, `totalRetirado`, `pedidosAbertos` (dias em fuso de São Paulo) |
| GET | `/pedidos?status=&pagina=&limite=` | token | Pedidos da organização |
| POST | `/pedidos` | token | `{bitola, comprimentoMm, quantidade, deviceId?}` → as peças saem do estoque na hora (409 se não houver); a máquina é avisada |
| POST | `/pedidos/:id/retirar` | token | Confirma a retirada (dono ou quem pediu) |
| POST | `/pedidos/:id/cancelar` | token | Cancela e devolve as peças ao estoque (dono ou quem pediu) |
| GET | `/eventos?de=&ate=&bitola=&valido=&pagina=&limite=` | token | Peças processadas (paginado) |
| GET | `/eventos/resumo?de=&ate=` | token | Peças válidas por dia e bitola |
| POST | `/eventos` | token | Simula uma peça na 1ª máquina da organização (só com `ALLOW_SIMULATION=true`) |
| GET | `/config` | token | Regras da organização |
| PUT | `/config` | dono | `{limiteBaixo?, kDesvios?, tabelaPeso?}` |
| GET | `/dispositivo` | token | Máquinas da organização e status |
| POST | `/dispositivo` | dono | `{nome}` → vincula máquina. Retorna `{dispositivo, token}` (**token só aparece aqui**) |
| POST | `/dispositivo/:id/token` | dono | Gera novo token (o antigo deixa de valer) |
| DELETE | `/dispositivo/:id` | dono | Remove a máquina (o histórico fica) |
| POST | `/dispositivo/comando` | token | `{ligado?: true\|false, tara?: true, deviceId?}` → 202. `tara` zera a balança |
| GET | `/equipe` | dono | `{membros, convites}` (convites pendentes, sem o código) |
| POST | `/equipe/convites` | dono | `{papel?: operador\|dono, dias?: 1-30}` → `{convite, codigo}` (**código só aparece aqui**; uso único) |
| DELETE | `/equipe/convites/:id` | dono | Revoga um convite pendente |
| POST | `/equipe/membros` | dono | `{nome, usuario, email, senha, papel?}` cria usuário direto na organização |
| PATCH | `/equipe/membros/:id` | dono | `{papel}` (a organização sempre mantém ao menos 1 dono) |
| DELETE | `/equipe/membros/:id` | dono | Remove o usuário (perde a sessão e o WebSocket na hora; não pode remover a si mesmo) |

## WebSocket (Socket.IO)
Conecte com `io(url, { auth: { token } })`. Cada conexão entra só na sala da sua organização. Eventos:
`estoque:atualizado`, `alerta:estoque-baixo`, `evento:novo`, `dispositivo:status`, `dispositivo:telemetria` (peso ao vivo, ~1x/s, não é gravado) e `pedido:atualizado`.

## MQTT (`<prefixo>` = `MQTT_TOPIC_PREFIX`; `<id>` = `deviceId` gerado pelo servidor)
Toda mensagem do ESP32 inclui `"token"`. Sem `deviceId` + token válidos, o backend descarta.

| Tópico | Sentido | Payload |
|---|---|---|
| `<prefixo>/<id>/evento` | ESP32 → backend | `{"comp":10,"bitola":"M3","peso":1.07,"valido":true,"token":"..."}` |
| `<prefixo>/<id>/status` | ESP32 → backend (retain + LWT) | `{"online":true,"ligado":true,"token":"..."}` |
| `<prefixo>/<id>/telemetria` | ESP32 → backend (~1x/s, sem retain) | `{"peso":1.07,"estavel":true,"rssi":-60,"token":"..."}` |
| `<prefixo>/<id>/cmd` | backend → ESP32 | `{"ligado":false}` (retain) ou `{"tara":true}` (**sem** retain) |
| `<prefixo>/<id>/pedido` | backend → ESP32 (sem retain) | `{"id":"...","comp":10,"bitola":"M3","qtd":20}` |
| `<prefixo>/<id>/alerta` | backend → ESP32 (retain) | `{"estoqueBaixo":true}` |

> Em broker público o token trafega em texto puro. Em produção use TLS e usuário/senha no broker.
