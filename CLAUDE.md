# CLAUDE.md

Bot de WhatsApp (Meta Cloud API) que atende pedidos de **segunda via de boleto** da ASSUSA,
consultando o back-end do **Sicoob**. Código-base derivado do sample *Jasper's Market* da Meta.

**Idioma:** docs, comentários e strings ao usuário em **pt-BR**. Mantenha esse padrão.

## Arquitetura em uma frase

Dois processos independentes: **Node/Express** na raiz (webhook WhatsApp, máquina de estados
no Redis) e **FastAPI** em `python/sicoob_service/` (cliente mTLS da API bancária Sicoob).
O Node fala com o Python por HTTP interno (`SICOOB_SERVICE_URL` + header `X-Internal-Api-Key`).

- `app.js` — rotas: `GET/POST /webhook`, `GET /`, `/privacy`, `/data-deletion`. Exporta `createApp()`
  para os testes; só sobe o servidor quando `require.main === module`.
- `services/` — toda a lógica: `conversation.js` (máquina de estados), `graph-api.js` (envio),
  `redis.js` (estado), `sicoobClient.js` (→ Python), `config.js`, `constants.js`, `mailer.js`.
- `python/sicoob_service/src/sicoob_service/` — `app.py` (rotas `/internal/*`, `/health`),
  `banking_v3.py`, `token_v3.py`, `certificate_tools.py`.

**Leia `docs/README.md` antes de mexer** — é o índice de toda a documentação.
Para o fluxo de conversa estado a estado: `docs/fluxo-mensagens.md`.
Para o contrato Node↔Python: `docs/sicoob/NODE_PYTHON_CONTRACT.md`.

## Comandos

```bash
npm start                 # node app.js (porta 8080)
npm test                  # node --test test/*.test.js
docker compose up --build # stack completa: redis + postgres + sicoob + web

cd python/sicoob_service && pip install -e ".[dev]" && pytest -q
```

## Armadilhas reais deste repo

**O `Dockerfile` copia apenas `app.js`, `services/` e `public/`.** Se você criar um novo
diretório de runtime na raiz, ele **não** chega ao container — atualize o `Dockerfile` junto.

**Nada de `.js` dentro de `public/`.** O CI falha explicitamente se encontrar algum. Isso
existe porque uma cópia do código-fonte (`public/app.js`) ficou exposta publicamente por
semanas. O CI também verifica que `GET /app.js` retorna 404.

**Nunca edite arquivos versionados direto na VPS.** Já causou drift que quebrou o `git pull`.
Toda mudança entra por commit em `main`. Na VPS só se toca em `.env` e `certificados/`
(gitignored, legitimamente só existem lá).

**Push em `main` = deploy automático em produção.** `ci.yml` roda testes Node + Python + build
Docker; se passar, `deploy.yml` dispara `scripts/deploy.sh` na VPS (pull, rebuild, health check,
**rollback automático** se o health falhar). Não faça push em `main` sem intenção de publicar.

**`require('./services/conversation')` conecta ao Redis como efeito colateral de módulo.**
Três defesas dependem disso e devem ser preservadas: `app.js` faz esse `require` *dentro* do
handler do POST; `test/webhook.test.js` cobre só casos que não disparam a cadeia; e
`test/cpf.test.js` lê `conversation.js` como **texto-fonte** (`readFileSync`) em vez de dar
`require`. Resultado: `npm test` passa sem Redis instalado (verificado — 18/18).

**`config.checkEnvVariables()` só emite `console.warn`.** Variável faltando não impede o boot —
o serviço sobe quebrado silenciosamente. Verifique os logs de arranque.

**`phone_number_id` vem do payload do webhook, não do `.env`.** As variáveis `WABA_ID`,
`PHONE_NUMBER_ID` e `BUSINESS_ID` existem só para `scripts/meta-numero.sh` e para manter
identificadores fora de arquivo versionado.

**Verify token aceita dois nomes:** `WHATSAPP_VERIFY_TOKEN` (preferido) ou `VERIFY_TOKEN` (legado).

## Segurança — o repositório é público

Nunca versione: tokens, App Secret, IDs de conta Meta, PIN de 2FA, CPF, dados de boleto,
IP/credenciais da VPS. Já estão no `.gitignore`: `.env*` (exceto `.env.sample`),
`certificados/`, `docs/boleto.md`, `docs/capturas/`, `.claude/`.

Ao documentar algo novo com identificador real, mova o valor para `.env` e deixe apenas o
nome da variável no doc — foi o que o commit `8f5d413` fez.

`docs/capturas/` está fora do git e portanto **sem backup** (ver `docs/capturas.md`).

## Estado no Redis

Chave por número de telefone, TTL deslizante de `ESTADO_TTL_SECONDS` (padrão 1800 s).
Estados: *(sem estado)* · `aguardando_cpf` · `aguardando_selecao_boleto`.
Palavras-chave de saída válidas em qualquer estado, sem acento e case-insensitive:
`menu` · `sair` · `voltar` · `cancelar` · `inicio`. Só valem para texto livre, não para cliques.

## Sicoob

`SICOOB_SANDBOX=true` é o padrão (sem certificados reais). Para produção é preciso
`SICOOB_NUMERO_CLIENTE`, `SICOOB_CLIENT_ID` de produção, o `.pfx` de produção e
`SICOOB_P12_PASSWORD` — checklist completo em `docs/PRODUCAO.md`.
