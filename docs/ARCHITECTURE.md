# Mapa mental e fluxo lógico do projeto

> Índice de toda a documentação: [docs/README.md](README.md). Para o contexto de negócio
> (o que é a ASSUSA, glossário do domínio) em vez de mapa de arquivos, ver [project-context.md](project-context.md).

Este repositório tem **dois processos** independentes: o **servidor Node (Express + WhatsApp)** na raiz e o **microsserviço FastAPI (Sicoob)** em [`python/sicoob_service/`](../python/sicoob_service/). O Node consulta o Python no arranque (`checkPythonHealth`) e durante a conversa: [`listarBoletos`](../services/sicoobClient.js) e [`segundaViaBoleto`](../services/sicoobClient.js) integram o fluxo de mensagens.

---

## 1. Mapa mental das pastas e ficheiros

```mermaid
mindmap
  root((segunda-via-wpp-assusa))
    raiz
      package.json
      app.js
      .env.sample
    services
      (migrado para api/ — ver CLAUDE.md)
    python_sicoob_service
      pyproject.toml
      src_sicoob_service
        app.py
        bootstrap.py
        settings.py
        banking_v3.py
        token_v3.py
        certificate_tools.py
        __main__.py
      tests
    docs
      meta
      sicoob
      postman
      prompts
    .github_workflows
      ci.yml
      deploy.yml
    scripts
      deploy.sh
```

**Papel de cada pasta**

- **Raiz**: ponto de entrada Node ([`app.js`](../app.js)), dependências ([`package.json`](../package.json)), variáveis de exemplo ([`.env.sample`](../.env.sample)).
- **[`services/`](../services/)**: toda a lógica do webhook WhatsApp (conversa, Graph API, Redis, config), a camada de
  apresentação das listagens ([`boletoView.js`](../services/boletoView.js), pura e testável) e o cliente HTTP para o Python.
- **[`python/sicoob_service/`](../python/sicoob_service/)**: API interna Sicoob (uvicorn/FastAPI), certificados, testes.
- **[`docs/`](.)**: contexto e contratos (não faz parte do runtime do servidor).
- **[`.github/workflows/`](../.github/workflows/) + [`scripts/deploy.sh`](../scripts/deploy.sh)**: CI/CD — testa e deploya sozinho todo push em `main`. Fluxo completo em [deploy.md](deploy.md).

---

## 2. Inicialização do Node e arranque do servidor

Ordem real de execução quando corre `npm start` → `node app.js`:

| Ordem | O que acontece | Onde |
|------|----------------|------|
| 1 | `require('dotenv').config()` (segunda vez em [`config.js`](../services/config.js) também) | [`app.js`](../app.js) L13; [`config.js`](../services/config.js) L11 |
| 2 | Carrega módulos: `config`, `Conversation`, `sicoobClient`, `Message` | [`app.js`](../app.js) L16–19 |
| 3 | Ao carregar `Conversation` → cadeia `Cache` → [`redis.js`](../services/redis.js): `createClient` + `client.connect()` (efeito lateral) | [`conversation.js`](../services/conversation.js) L15; [`redis.js`](../services/redis.js) L13–24 |
| 4 | Ao carregar `GraphApi` → `FacebookAdsApi(config.accessToken)` | [`graph-api.js`](../services/graph-api.js) L10–13 |
| 5 | `express()`, `app.use(urlencoded)`, `app.use(json({ verify: verifyRequestSignature }))` | [`app.js`](../app.js) L20–30 |
| 6 | Registo de rotas: `GET /webhook`, `POST /webhook`, `GET /` (página), `GET /status`, `/privacy`, `/data-deletion`, `/logo-assusa.png` | [`app.js`](../app.js) L33–85 |
| 7 | `config.checkEnvVariables()` — avisos se faltam env vars | [`app.js`](../app.js) L88; [`config.js`](../services/config.js) L33–38 |
| 8 | `app.listen(config.port, async () => { ... })` → log porta; `sicoobClient.checkPythonHealth()` | [`app.js`](../app.js) L110–123 |

**Funções nomeadas no arranque**

- [`verifyRequestSignature`](../app.js) — middleware de verificação HMAC `x-hub-signature-256` (corre em cada `POST` com body JSON).
- [`config.checkEnvVariables`](../services/config.js) — percorre `ENV_VARS` e faz `console.warn` se faltar variável.
- [`sicoobClient.checkPythonHealth`](../services/sicoobClient.js) — `GET {SICOOB_SERVICE_URL}/health` (ou `skipped` se URL não configurada).

```mermaid
flowchart TD
  start[npm start / node app.js]
  dotenv[dotenv.config]
  reqMods[require config Conversation sicoobClient Message]
  sideRedis[redis.js: createClient e connect]
  sideFB[graph-api: FacebookAdsApi]
  express[express + body parsers + rotas]
  checkEnv[config.checkEnvVariables]
  listen[app.listen port]
  health[sicoobClient.checkPythonHealth]
  start --> dotenv --> reqMods
  reqMods --> sideRedis
  reqMods --> sideFB
  reqMods --> express --> checkEnv --> listen --> health
```

---

## 3. Fluxo HTTP após o servidor a escuta

```mermaid
flowchart LR
  subgraph getVerify [GET /webhook]
    G1[Compara hub.mode e hub.verify_token com config.verifyToken]
    G2[Responde hub.challenge ou 403]
  end
  subgraph postHook [POST /webhook]
    P1[JSON parse com verifyRequestSignature]
    P2[Itera entry.changes.value]
    P3a[statuses: Conversation.handleStatus]
    P3b[messages: Conversation.handleMessage]
    P4[200 EVENT_RECEIVED]
  end
  subgraph root [GET /]
    R1[JSON health info Jasper]
  end
```

---

## 4. Funções na cadeia de mensagens e estado

**[`Conversation.handleMessage`](../services/conversation.js)** (estático)

- Instancia `Message(rawMessage)`.
- `switch (message.type)` sobre IDs em [`constants.js`](../services/constants.js).
- Chama funções internas ao ficheiro: `sendTryOutDemoMessage`, `sendInteractiveMediaMessage`, `sendLimitedTimeOfferMessage`, `sendMediaCarouselMessage`, `markMessageForFollowUp`.
- `markMessageForFollowUp` → [`Cache.insert`](../services/redis.js).

**[`Conversation.handleStatus`](../services/conversation.js)**

- Instancia `Status(rawStatus)`.
- Filtra só `delivered` / `read`.
- Se [`Cache.remove`](../services/redis.js)(`messageId`) devolver verdadeiro → `sendTryOutDemoMessage` com mensagem de follow-up.

**[`GraphApi`](../services/graph-api.js)** (métodos estáticos; chamada real via `#makeApiCall` privado)

- `messageWithText`, `messageWithInteractiveReply` (até 3 botões), `messageWithInteractiveList` (até 10 linhas),
  `messageWithDocument`, `uploadMedia`, e os de template herdados do sample: `messageWithUtilityTemplate`,
  `messageWithLimitedTimeOfferTemplate`, `messageWithMediaCardCarousel`.

**Modelos**

- [`Message` constructor](../api/interface/payloadWhatsApp.js) — extrai `id`, `type` (de `interactive.button_reply.id` **ou** `interactive.list_reply.id`, senão `'unknown'`), `text`, `from`.
- [`Status` constructor](../api/interface/payloadWhatsApp.js) — `id`, `status`, `recipient_id`.

**Cliente Sicoob (Node)**

- [`baseUrl`](../services/sicoobClient.js), [`internalHeaders`](../services/sicoobClient.js), [`checkPythonHealth`](../services/sicoobClient.js).
- [`listarBoletos`](../services/sicoobClient.js) → `POST /internal/boleto/listar`, disparado em janelas paralelas por
  [`montarJanelas`](../services/sicoobClient.js) (a API filtra por data de **vencimento** e recusa intervalos > 35 dias).
- [`segundaViaBoleto`](../services/sicoobClient.js) → `POST /internal/boleto/segunda-via`, usado tanto para atualizar o
  valor de cada conta listada quanto para gerar o PDF entregue.

---

## 5. Inicialização do microsserviço Python (referência)

- Entrada típica: `python -m sicoob_service` ou comando definido no pacote → [`__main__.py`](../python/sicoob_service/src/sicoob_service/__main__.py) chama `get_settings()` e `uvicorn.run("sicoob_service.app:app", ...)`.
- [`app.py`](../python/sicoob_service/src/sicoob_service/app.py): instância `FastAPI`, rotas `/health`, `/internal/boleto/*` com `verify_internal_key` e `banking_dependency` → [`create_banking_client`](../python/sicoob_service/src/sicoob_service/bootstrap.py) → [`BankingSicoobV3`](../python/sicoob_service/src/sicoob_service/banking_v3.py).
