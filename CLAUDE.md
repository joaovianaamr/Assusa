# CLAUDE.md

Bot de WhatsApp (Meta Cloud API) que atende pedidos de **segunda via de boleto** da ASSUSA,
consultando o back-end do **Sicoob**. Código-base derivado do sample *Jasper's Market* da Meta.

**Idioma:** docs, comentários e strings ao usuário em **pt-BR**. Mantenha esse padrão.

## Arquitetura em uma frase

Três componentes isolados: **API** (`api/` + `app.js` — Node/Express em camadas, webhook do
WhatsApp e máquina de estados no Redis), **processamento Sicoob** (`sicoob/` —
FastAPI, cliente mTLS da API bancária) e **frontend** (`web/` — HTML estático). São dois
processos: o Node fala com o Python por HTTP interno (`SICOOB_SERVICE_URL` + header
`X-Internal-Api-Key`), e o frontend é servido pela API.

- `app.js` — rotas: `GET/POST /webhook`, `GET /` (página institucional), `GET /status` (diagnóstico
  JSON), `/privacy`, `/data-deletion`, `/logo-assusa.png`. Exporta `createApp()` para os testes; só
  sobe o servidor quando `require.main === module`.
- `api/` — o componente Node em camadas. `domain/` (cpf, boleto, mensagens, portas — puro),
  `application/` (um arquivo por caso de uso), `infrastructure/` (whatsappGraph, sessaoRedis,
  sicoobHttp, telemetriaHttp), `interface/` (`webhookRouter.js` e `payloadWhatsApp.js`) e
  `composicao.js` (composition root — o único lugar que liga porta a adapter).
- `web/` — o frontend estático (páginas institucional, de privacidade e de exclusão de dados).
- `sicoob/src/sicoob_service/` — `app.py` (rotas `/internal/*`, `/health`),
  `banking_v3.py`, `token_v3.py`, `certificate_tools.py`.

**Leia `docs/README.md` antes de mexer** — é o índice de toda a documentação.
Para o fluxo de conversa estado a estado: `docs/fluxo-mensagens.md`.
Para o contrato Node↔Python: `docs/sicoob/NODE_PYTHON_CONTRACT.md`.

## Comandos

```bash
npm start                 # node app.js (porta 8080)
npm test                  # node --test test/*.test.js
docker compose up --build # stack completa: redis + postgres + sicoob + web

cd sicoob && pip install -e ".[dev]" && pytest -q
```

## Armadilhas reais deste repo

**O `Dockerfile` copia apenas `app.js`, `api/` e `web/`.** Se você criar um novo
diretório de runtime na raiz, ele **não** chega ao container — atualize o `Dockerfile` junto.

**Nada de `.js` dentro de `web/`** (o antigo `public/`). O CI falha explicitamente se encontrar
algum. Isso existe porque uma cópia do código-fonte ficou exposta publicamente por semanas. O CI
e `test/webhook.test.js` também verificam que `GET /app.js` retorna 404. Os arquivos de `web/`
são servidos por rota explícita com `sendFile`, nunca por `express.static`.

**A raiz é a página institucional; o JSON de diagnóstico vive em `/status`.** O smoke test do
CI procura `ASSUSA` na raiz e `Servidor ativo` em `/status` — mover uma dessas strings quebra a
esteira, e o `deploy.yml` só roda se o CI passar. Os health checks do `Dockerfile` e do
`scripts/deploy.sh` olham apenas o código 200 da raiz.

**Nunca edite arquivos versionados direto na VPS.** Já causou drift que quebrou o `git pull`.
Toda mudança entra por commit em `main`. Na VPS só se toca em `.env` e `certificados/`
(gitignored, legitimamente só existem lá).

**Push em `main` = deploy automático em produção.** `ci.yml` roda testes Node + Python + build
Docker; se passar, `deploy.yml` dispara `scripts/deploy.sh` na VPS (pull, rebuild, health check,
**rollback automático** se o health falhar). Não faça push em `main` sem intenção de publicar.

**A conexão SSH do deploy falha de vez em quando — o workflow já absorve.** Desde jul/2026 o
step tenta 3 vezes (10 s e 20 s entre elas) e só repete em `exit 255`, que é erro do próprio
`ssh`; qualquer outro código vem do `deploy.sh` e falha na hora, porque aí o deploy quebrou de
verdade. O `flock` em `scripts/deploy.sh` cobre o caso de a conexão cair com o script já
rodando, que também devolve 255.

Ver `ssh: Connection timed out` no log com o deploy verde é normal: foi uma tentativa perdida.
Se as **três** falharem, o log traz um bloco `Diagnóstico de rede` medindo, do próprio runner,
quais portas da VPS respondem — a tabela de interpretação está em `docs/deploy.md`. A hipótese
de trabalho é filtro na porta 22, porque durante as falhas a 443 responde e a 22 aceita conexão
de outras origens. O que se sabe do episódio de 28/07/2026:

- **Não há firewall na VPS** — `ufw` inativo, `iptables INPUT` com policy ACCEPT e sem regras.
  Não procure bloqueio ali, e não vá mexer no painel do provedor por causa disso.
- O sintoma é enganoso: `journalctl -u ssh` **não registra tentativa nenhuma** durante a falha,
  o que parece prova de bloqueio de rede permanente. Não é — pacote perdido no caminho produz
  exatamente o mesmo silêncio.
- Diagnóstico rápido, nesta ordem: `curl -sI https://assusa.tech` (a VPS está viva?), depois
  `ssh` na VPS a partir da sua máquina (a porta 22 responde de outra origem?). Se as duas
  passarem, é transitório: **espere ~30 min e re-rode o workflow**.
- Só depois disso vale suspeitar de rede/provedor. E existe a saída manual: rodar
  `bash scripts/deploy.sh` direto na VPS faz exatamente o que o runner faria.
- A unit do SSH aqui chama-se **`ssh.service`**, não `sshd.service` — vale para `journalctl` e
  para configurar qualquer coisa que leia esse log.

**A conexão com o Redis é preguiçosa — importar não faz I/O.** Era o contrário: o adapter
chamava `client.connect()` no topo, então importar a cadeia da conversa abria socket sem pedir.
Três defesas existiam só para contornar isso — o `require` tardio dentro do handler em `app.js`,
o cuidado no `webhook.test.js` e a leitura do `conversation.js` como texto no `cpf.test.js`.
**As três já não existem**, porque a causa foi removida: `api/infrastructure/sessaoRedis.js`
conecta na primeira operação. `test/sessaoRedis.test.js` monta o composition root inteiro e falha
se alguém devolver a conexão para o topo do arquivo.

**Camadas em `api/` com fronteira verificada.** `domain/` (cpf, boleto, mensagens, portas — puro),
`application/` (um arquivo por caso de uso), `infrastructure/` (os quatro adapters),
`interface/` (roteador e tradutores do payload) e `composicao.js` fora das camadas. As setas
apontam só para dentro e `scripts/boundary_lint.py` roda no CI com `.arch.json` — o build falha
quando uma seta aponta para fora. As portas em `api/domain/portas/` são verificadas por
`test/portas.test.js`: renomear um método de adapter quebra o teste, não a produção.

**Adapter não faz trabalho ao ser importado — nem conexão, nem construção de cliente.**
`sessaoRedis` conecta na primeira operação e `whatsappGraph` só constrói o cliente do SDK na
primeira chamada. `new FacebookAdsApi(token)` **lança** com token indefinido, e no CI não há
`.env`: com a construção no topo, o container morria no arranque e o smoke test reprovava.
`test/arranqueSemEnv.test.js` sobe um processo limpo, sem herdar variável nenhuma, e falha se
algum adapter voltar a trabalhar no import — é o único teste que enxerga essa classe de erro,
porque os demais definem ACCESS_TOKEN e no desenvolvimento local o `.env` existe.

**Nenhum caso de uso importa adapter.** Eles recebem `bancoBoletos`, `sessao`, `notificador` e
`telemetria` por parâmetro; quem liga porta a adapter é só o composition root. Ao criar um caso
de uso novo, siga o padrão: `module.exports = function criar({ ... }) { ... }`.

**Mensagem de botões da Meta aceita no máximo 3 botões; lista interativa, 10 linhas.**
Por isso a listagem de contas bifurca em `apresentarBoletos` (`≤ 3` → botões, `≥ 4` → lista) e
o teto de contas exibidas é 10. Toda resposta interativa é normalizada em `api/interface/payloadWhatsApp.js`,
que lê `button_reply` **e** `list_reply` — clique de botão e toque em item chegam com o mesmo
id `boleto-N`. Ler só `button_reply` derruba o handler do webhook com `TypeError`.

**A busca de boletos filtra por data de VENCIMENTO, não por "está em aberto hoje".**
`codigoSituacao=1` (Em Aberto) e `dataInicio`/`dataFim` são filtros independentes: um boleto
registrado agora com vencimento em duas semanas já está em aberto, mas fica fora do recorte se
a janela terminar em `hoje`. Por isso `montarJanelas` (`api/infrastructure/sicoobHttp.js`) começa em
`hoje + SICOOB_DIAS_FUTURO`. As janelas precisam ser contíguas e nunca passar de 35 dias — o
Sicoob recusa com `5002`. `test/janelasBusca.test.js` trava as três coisas.

**Toda mensagem de fim de fluxo leva o botão "Voltar ao menu"** (`enviarComBotaoMenu`).
O público é majoritariamente idoso: exigir que digitem "menu" para recomeçar deixava gente
presa. O id `assusa-menu` está em `MENU_BUTTONS`, então limpa estado e boletos antes do
dispatch. Ao acrescentar uma nova mensagem de erro, use `enviarComBotaoMenu`, não
`GraphApi.messageWithText`.

**Depois do PDF vem UMA lista de facilidades, não uma chuva de mensagens.** Até jul/2026 a
entrega disparava seis mensagens (PDF, rótulo + linha digitável, rótulo + PIX, fechamento);
no celular as primeiras subiam para fora da tela e, com o teclado aberto, sobrava meia tela —
o público é majoritariamente idoso. Hoje são duas: o PDF e a lista `Formas de pagar`
(`oferecerFacilidades`), cujas linhas entregam o código **sob demanda**. Cada código continua
chegando sozinho na mensagem — o WhatsApp copia a mensagem inteira, então rótulo junto do
código iria para a área de transferência. Os códigos ficam em `codigos:<telefone>` no Redis
com o mesmo TTL deslizante; sem isso cada toque custaria uma consulta nova ao Sicoob.

**`assusa-ver-outras`, `assusa-linha-digitavel` e `assusa-pix-copia-cola` NÃO podem entrar em
`MENU_BUTTONS`.** Depois de entregar um boleto o bot mantém estado, lista e códigos no Redis
por 30 min, para o cliente pedir outra conta ou o outro código sem redigitar o CPF
(`refrescarSessaoBoletos`). Os ids de `MENU_BUTTONS` limpam estado, boletos **e** códigos — se
esses três estivessem lá, destruiriam a sessão que existe justamente para eles. Por isso são
interceptados no topo de `handleMessage`, antes da máquina de estados: dentro de
`aguardando_selecao_boleto` cairiam em `handleSelecaoBoleto` e virariam "não entendi".

**A Meta recusa a mensagem interativa inteira (400) por detalhe de formato.** Três defesas
dependem disso e devem ser preservadas: `enviarSelecaoBoletos` cai para texto simples pedindo o
número da conta; o estado `aguardando_selecao_boleto` só é gravado **depois** do envio bem-sucedido
(gravar antes prende o cliente num estado cuja mensagem ele nunca viu); e `view.resolverIndiceSelecao`
aceita botão, item de lista e número digitado, então o fallback é utilizável. O `.catch` do webhook
em `app.js` chama `Conversation.avisarFalhaInesperada` — sem isso, erro no fluxo vira silêncio.

**As rotas do `sicoob/` são `def`, não `async def` — não "corrija" isso.** O cliente Sicoob é
síncrono (`httpx.Client`, e `time.sleep()` no retry de 429); numa rota `async` ele bloqueia o
event loop e as 6 janelas que o Node dispara em paralelo passam a ser atendidas em fila. Medido:
6 requisições simultâneas em **0,721 s** com `async def` contra **0,096 s** com `def`. Vale
também para `banking_dependency`, que renova o token via mTLS. Trocar de volta não quebra nada —
só deixa ~7× mais lento sob carga, em silêncio.

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

**SSH da VPS: só chave, sem senha.** Aplicado em 28/07/2026, depois de 498 tentativas de brute
force vindas de 8+ IPs (nenhuma bem-sucedida). Configuração em
`/etc/ssh/sshd_config.d/00-hardening.conf`: `PasswordAuthentication no` e `PermitRootLogin
prohibit-password`, mais `fail2ban` no jail `sshd`.

Duas pegadinhas que custaram tempo e vão se repetir em qualquer ajuste ali:

- **O `Include` está na linha 12 do `sshd_config` e o primeiro valor lido vence.** Por isso
  `50-cloud-init.conf` (`PasswordAuthentication yes`) derrotava silenciosamente o
  `60-cloudimg-settings.conf` (`no`). O arquivo de hardening começa com `00-` justamente para
  vir antes de todos. Sempre confira o resultado com `sshd -T`, nunca lendo um arquivo só.
- **O `fail2ban` instala apontando para `sshd.service`, mas a unit aqui é `ssh.service`** — sem
  o `journalmatch` explícito no `jail.local` ele não lê nada e dá falsa sensação de proteção.
  Para validar de verdade: `fail2ban-regex <log> /etc/fail2ban/filter.d/sshd.conf`.

O deploy do CI entra como `root` por chave. Migrar para um usuário sem privilégio é o próximo
passo de endurecimento — exige trocar `VPS_USER`/`VPS_SSH_KEY` nos secrets e testar.

## Estado no Redis

Três chaves por número de telefone (`estado:`, `boletos:`, `codigos:`), TTL deslizante de
`ESTADO_TTL_SECONDS` (padrão 1800 s).
Estados: *(sem estado)* · `aguardando_cpf` · `aguardando_selecao_boleto`.
Palavras-chave de saída válidas em qualquer estado, sem acento e case-insensitive:
`menu` · `sair` · `voltar` · `cancelar` · `inicio`. Só valem para texto livre, não para cliques.

## Sicoob

`SICOOB_SANDBOX=true` é o padrão (sem certificados reais). Para produção é preciso
`SICOOB_NUMERO_CLIENTE`, `SICOOB_CLIENT_ID` de produção, o `.pfx` de produção e
`SICOOB_P12_PASSWORD` — checklist completo em `docs/PRODUCAO.md`.
