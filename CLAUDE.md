# CLAUDE.md

Bot de WhatsApp (Meta Cloud API) que atende pedidos de **segunda via de boleto** da ASSUSA,
consultando o back-end do **Sicoob**. Código-base derivado do sample *Jasper's Market* da Meta.

**Idioma:** docs, comentários e strings ao usuário em **pt-BR**. Mantenha esse padrão.

## Arquitetura em uma frase

Dois processos independentes: **Node/Express** na raiz (webhook WhatsApp, máquina de estados
no Redis) e **FastAPI** em `python/sicoob_service/` (cliente mTLS da API bancária Sicoob).
O Node fala com o Python por HTTP interno (`SICOOB_SERVICE_URL` + header `X-Internal-Api-Key`).

- `app.js` — rotas: `GET/POST /webhook`, `GET /` (página institucional), `GET /status` (diagnóstico
  JSON), `/privacy`, `/data-deletion`, `/logo-assusa.png`. Exporta `createApp()` para os testes; só
  sobe o servidor quando `require.main === module`.
- `services/` — toda a lógica: `conversation.js` (máquina de estados), `graph-api.js` (envio),
  `redis.js` (estado), `sicoobClient.js` (→ Python), `boletoView.js` (formatação e montagem
  das listagens, puro), `message.js` (parse do payload), `config.js`, `constants.js`.
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

**A raiz é a página institucional; o JSON de diagnóstico vive em `/status`.** O smoke test do
CI procura `ASSUSA` na raiz e `Servidor ativo` em `/status` — mover uma dessas strings quebra a
esteira, e o `deploy.yml` só roda se o CI passar. Os health checks do `Dockerfile` e do
`scripts/deploy.sh` olham apenas o código 200 da raiz.

**Arquivos de `public/` são servidos por rota explícita, nunca por `express.static`.** Cada um
tem seu `app.get(...)` com `sendFile`. Expor o diretório inteiro é justamente o que deixou uma
cópia do código-fonte pública por semanas.

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
`require`. Resultado: `npm test` passa sem Redis instalado (verificado — 78/78).
Os testes que exercitam o fluxo mockam `Cache` com `t.mock.method` antes de chamar
`Conversation.handleMessage`; lógica nova que dê para isolar deve ir para `boletoView.js`,
que é puro e pode ser testado com `require` direto.

**Mensagem de botões da Meta aceita no máximo 3 botões; lista interativa, 10 linhas.**
Por isso a listagem de contas bifurca em `apresentarBoletos` (`≤ 3` → botões, `≥ 4` → lista) e
o teto de contas exibidas é 10. Toda resposta interativa é normalizada em `services/message.js`,
que lê `button_reply` **e** `list_reply` — clique de botão e toque em item chegam com o mesmo
id `boleto-N`. Ler só `button_reply` derruba o handler do webhook com `TypeError`.

**A busca de boletos filtra por data de VENCIMENTO, não por "está em aberto hoje".**
`codigoSituacao=1` (Em Aberto) e `dataInicio`/`dataFim` são filtros independentes: um boleto
registrado agora com vencimento em duas semanas já está em aberto, mas fica fora do recorte se
a janela terminar em `hoje`. Por isso `montarJanelas` (`services/sicoobClient.js`) começa em
`hoje + SICOOB_DIAS_FUTURO`. As janelas precisam ser contíguas e nunca passar de 35 dias — o
Sicoob recusa com `5002`. `test/janelasBusca.test.js` trava as três coisas.

**Toda mensagem de fim de fluxo leva o botão "Voltar ao menu"** (`enviarComBotaoMenu`).
O público é majoritariamente idoso: exigir que digitem "menu" para recomeçar deixava gente
presa. O id `assusa-menu` está em `MENU_BUTTONS`, então limpa estado e boletos antes do
dispatch. Ao acrescentar uma nova mensagem de erro, use `enviarComBotaoMenu`, não
`GraphApi.messageWithText`.

**`assusa-ver-outras` NÃO pode entrar em `MENU_BUTTONS`.** Depois de entregar um boleto o bot
mantém estado e lista no Redis por 30 min, para o cliente pedir outra conta sem redigitar o CPF
(`refrescarSessaoBoletos`). Os ids de `MENU_BUTTONS` limpam estado **e** boletos — se o botão
"Ver outras contas" estivesse lá, ele destruiria a sessão que existe justamente para ele. Por
isso é interceptado no topo de `handleMessage`, antes da máquina de estados: dentro de
`aguardando_selecao_boleto` ele cairia em `handleSelecaoBoleto` e viraria "não entendi".

**A Meta recusa a mensagem interativa inteira (400) por detalhe de formato.** Três defesas
dependem disso e devem ser preservadas: `enviarSelecaoBoletos` cai para texto simples pedindo o
número da conta; o estado `aguardando_selecao_boleto` só é gravado **depois** do envio bem-sucedido
(gravar antes prende o cliente num estado cuja mensagem ele nunca viu); e `view.resolverIndiceSelecao`
aceita botão, item de lista e número digitado, então o fallback é utilizável. O `.catch` do webhook
em `app.js` chama `Conversation.avisarFalhaInesperada` — sem isso, erro no fluxo vira silêncio.

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
