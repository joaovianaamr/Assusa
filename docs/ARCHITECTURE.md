# Mapa mental e fluxo lógico do projeto

> Índice de toda a documentação: [docs/README.md](README.md). Para o contexto de negócio
> (o que é a ASSUSA, glossário do domínio) em vez de mapa de arquivos, ver [project-context.md](project-context.md).
> Para o fluxo de conversa estado a estado: [fluxo-mensagens.md](fluxo-mensagens.md).
> Para o histórico da migração em camadas: [arquitetura-isolamento.md](arquitetura-isolamento.md).

## Três componentes

| Componente | Onde | O que é |
|---|---|---|
| **API** | `api/` + `app.js` | Node/Express: recebe o webhook do WhatsApp, conduz a conversa, fala com o Sicoob |
| **Processamento Sicoob** | `python/sicoob_service/` | FastAPI: cliente mTLS da API bancária. Processo próprio, contrato HTTP |
| **Frontend** | `web/` | HTML estático servido pela API por rota explícita |

O Node fala com o Python por HTTP interno (`SICOOB_SERVICE_URL` + header `X-Internal-Api-Key`);
o contrato está em [sicoob/NODE_PYTHON_CONTRACT.md](sicoob/NODE_PYTHON_CONTRACT.md). Além dos
boletos, o Python também grava a telemetria de atendimento no Postgres
(`POST /interno/interacao`).

---

## 1. O componente API, por dentro

Arquitetura em camadas (Clean/Hexagonal). **As setas de dependência apontam só para dentro.**

```
app.js                        entrada HTTP: rotas, verificação de assinatura, páginas
│
└── api/
    ├── composicao.js         composition root — o ÚNICO lugar que vê tudo
    │
    ├── domain/               regras puras: sem framework, sem I/O, sem rede
    │   ├── cpf.js              normalizar, validar (módulo 11), mascarar
    │   ├── boleto.js           ordenar, cortar em 10, decidir botões vs. lista,
    │   │                       respeitar os limites da Meta, resolver a seleção
    │   ├── mensagens.js        todo texto que o cliente lê
    │   └── portas/index.js     o que o domínio exige do mundo + verificador
    │
    ├── application/          um arquivo por caso de uso — recebe as portas por parâmetro
    │   ├── consultarPorCpf.js       consulta e decide o desfecho
    │   ├── listagemBoletos.js       monta, envia e reexibe a lista
    │   ├── entregarSegundaVia.js    entrega o PDF e fecha o atendimento
    │   └── mensageria.js            envios compartilhados entre os casos de uso
    │
    ├── infrastructure/       adapters que implementam as portas
    │   ├── sicoobHttp.js       → serviço Python (janelas de busca)
    │   ├── whatsappGraph.js    → Meta Cloud API
    │   ├── sessaoRedis.js      → Redis (estado da conversa)
    │   └── telemetriaHttp.js   → Postgres via Python
    │
    ├── interface/            fronteira de entrada
    │   ├── webhookRouter.js      roteamento por estado da conversa
    │   └── payloadWhatsApp.js    traduz o payload da Meta (Message, Status)
    │
    └── config.js             variáveis de ambiente (fora das camadas, como o wiring)
```

**A regra é verificada, não combinada:** `domain` não importa ninguém; `application` importa só
`domain`; `infrastructure` e `interface` importam `domain` + `application`, nunca um ao outro;
ninguém importa `interface`. O contrato está em [`.arch.json`](../.arch.json) e
[`scripts/boundary_lint.py`](../scripts/boundary_lint.py) **falha o CI** quando uma seta aponta
para fora.

`composicao.js` fica fora das camadas de propósito: a regra "ninguém enxerga todo mundo" precisa
de exatamente uma exceção declarada, senão o wiring vaza de volta para dentro das camadas.

### Por que dá para testar sem Redis, sem rede e sem token

Nenhum caso de uso importa adapter — todos recebem `bancoBoletos`, `sessao`, `notificador` e
`telemetria` por parâmetro. Trocar qualquer peça em teste não exige tocar em produção.

E **nenhum adapter faz trabalho ao ser importado**: `sessaoRedis` conecta na primeira operação,
`whatsappGraph` só constrói o cliente do SDK na primeira chamada. Isso não é estilo —
`new FacebookAdsApi(token)` lança com token indefinido, e foi assim que o container morreu no
arranque uma vez. [`test/arranqueSemEnv.test.js`](../test/arranqueSemEnv.test.js) guarda a
propriedade subindo um processo sem nenhuma variável de ambiente.

---

## 2. Arranque do servidor

| # | O que acontece | Onde |
|---|---|---|
| 1 | `dotenv` carrega o `.env` | [`app.js`](../app.js), [`api/config.js`](../api/config.js) |
| 2 | `require("./api/composicao")` monta as camadas e liga porta a adapter | [`api/composicao.js`](../api/composicao.js) |
| 3 | `createApp()` registra as rotas | [`app.js`](../app.js) |
| 4 | `config.checkEnvVariables()` — só `console.warn` se faltar variável | [`api/config.js`](../api/config.js) |
| 5 | `listen(config.port)` e health check do serviço Python | [`app.js`](../app.js) |

Nenhum desses passos abre conexão com Redis ou com a Meta. O primeiro I/O real acontece quando
chega a primeira mensagem.

---

## 3. Rotas HTTP

| Rota | O que faz |
|---|---|
| `GET /` | Página institucional (`web/index.html`) |
| `GET /status` | Diagnóstico JSON — o smoke test do CI procura "Servidor ativo" aqui |
| `GET /webhook` | Handshake de verificação da Meta (`hub.challenge`) |
| `POST /webhook` | Recebe eventos; delega ao `router` do composition root |
| `GET /privacy`, `GET /data-deletion` | Páginas legais exigidas pela revisão da Meta |
| `POST /data-deletion` | Recebe pedido de exclusão (a exclusão real ainda é um TODO) |
| `GET /logo-assusa.png` | Logo usada pela página e pelo preview de link |

Arquivos de `web/` são servidos por **rota explícita com `sendFile`, nunca por
`express.static`** — expor o diretório inteiro é o que já deixou uma cópia do código-fonte
pública por semanas.

---

## 4. Caminho de uma mensagem

```
POST /webhook
   │  app.js valida assinatura (x-hub-signature-256, quando presente)
   ▼
router.handleMessage                     api/interface/webhookRouter.js
   │  Message traduz o payload           api/interface/payloadWhatsApp.js
   │  lê o estado da sessão              porta sessao → sessaoRedis
   │
   ├── palavra-chave de saída ─────────► menu principal, sessão descartada
   ├── botão "Ver outras contas" ──────► listagem.reexibirBoletos (cache, 0 chamadas ao Sicoob)
   ├── estado aguardando_cpf ──────────► consulta.handleCpfRecebido
   │        │  cpf.apenasDigitos + cpf.cpfValido       (domain)
   │        │  bancoBoletos.listarBoletos              (porta → sicoobHttp → Python → Sicoob)
   │        └─► listagem.apresentarBoletos
   │                 boleto.deveUsarLista / montarRows  (domain, limites da Meta)
   │                 notificador.messageWith…           (porta → whatsappGraph → Meta)
   ├── estado aguardando_selecao ──────► entrega.handleSelecaoBoleto
   │                 bancoBoletos.segundaViaBoleto → PDF, linha digitável, PIX
   │                 entrega.fecharEntrega → "Ver outras contas" / "Voltar ao menu"
   └── qualquer outra coisa ───────────► menu principal
```

Todo desfecho registra um evento pela porta `telemetria` — a lista está em
[fluxo-mensagens.md](fluxo-mensagens.md).

---

## 5. Estado no Redis

Chave por telefone, TTL deslizante de `ESTADO_TTL_SECONDS` (padrão 1800 s):

- `estado:<telefone>` — *(sem estado)* · `aguardando_cpf` · `aguardando_selecao_boleto`
- `boletos:<telefone>` — a lista já com valores atualizados, para o cliente pedir outra conta
  sem redigitar o CPF

---

## 6. Testes

103 no Node, todos rodando **sem Redis instalado**, e 48 no Python.

| Arquivo | Guarda o quê |
|---|---|
| `cpf.test.js`, `boletoView.test.js` | regras de domínio e os limites da Meta |
| `janelasBusca.test.js` | janelas de busca contíguas, nunca acima de 35 dias, alcançando o futuro |
| `portas.test.js` | cada adapter cumpre a porta que o domínio declara |
| `sessaoRedis.test.js` | importar não conecta ao Redis |
| `arranqueSemEnv.test.js` | o processo sobe sem nenhuma variável de ambiente |
| `message.test.js` | tradução do payload, incluindo `list_reply` |
| `webhook.test.js` | rotas HTTP e o fluxo de conversa ponta a ponta |
