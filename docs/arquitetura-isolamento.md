# Isolamento dos componentes — plano de migração

Proposta para separar **API**, **processamento Sicoob** e **frontend** em fronteiras
explícitas dentro do monorepo, e para quebrar o acoplamento interno do Node.

> Status: proposta. Nada aqui foi executado.

## Por que

Auditoria de dependências do estado atual (`services/*.js` + `app.js`):

| Módulo | Importa internamente | Papel real |
|---|---|---|
| `conversation.js` | **9 dos 10 módulos** | máquina de estados + regra de negócio + apresentação + I/O |
| `boletoView.js` | `constants` | puro — formatação e decisão de layout |
| `message.js`, `status.js`, `constants.js` | — | puros |
| `graph-api.js`, `redis.js`, `sicoobClient.js`, `interacaoClient.js` | `config` | adapters de saída |
| `app.js` | `config`, `sicoobClient`, `conversation` | entrada HTTP + wiring |

Duas conclusões:

1. **As camadas já existem, sem nome nem fronteira.** Há um domínio puro, adapters e uma
   camada de entrada — só não estão declarados, então nada impede que se misturem.
2. **`conversation.js` é o problema real.** Separar os três componentes em caixas diferentes
   não o resolve: ele continuaria acumulando responsabilidades dentro da caixa "API".

O sintoma mais caro disso está documentado no `CLAUDE.md`: `require('./services/conversation')`
**conecta ao Redis como efeito colateral de módulo**. Três defesas no código e nos testes
existem só para contornar isso. Com as dependências injetadas, a causa desaparece e as três
defesas deixam de ser necessárias.

## Decisões

- **Fronteiras no monorepo**, não três deployments. O `deploy.sh` e o `docker-compose`
  continuam praticamente iguais.
- **Migração incremental**: cada fase termina com `npm test` verde e é publicável sozinha.
  Isto está em produção, e todo push em `main` publica.
- **`python/sicoob_service/` fica como está.** Já é um componente isolado de verdade —
  processo próprio, contrato HTTP em `docs/sicoob/NODE_PYTHON_CONTRACT.md`, 48 testes. Não há
  problema correspondente ao trabalho de formalizar camadas nele.

## Estrutura alvo

```
segunda-via-wpp-assusa/
├── api/                       componente 1 — Node
│   ├── domain/                regras puras, sem framework e sem I/O
│   │   ├── cpf.js             validação (hoje dentro de conversation.js)
│   │   ├── boleto.js          ordenação, corte, seleção (hoje em boletoView.js)
│   │   ├── mensagens.js       textos ao cliente (hoje constants.js)
│   │   └── portas/            contratos que o domínio exige de fora
│   │       ├── boletos.js       listar / segundaVia
│   │       ├── sessao.js        ler / gravar / limpar
│   │       ├── notificador.js   enviar texto, botões, lista, documento
│   │       └── telemetria.js    registrar evento
│   ├── application/           um arquivo por caso de uso
│   │   ├── iniciarAtendimento.js
│   │   ├── consultarPorCpf.js
│   │   ├── apresentarBoletos.js
│   │   └── entregarSegundaVia.js
│   ├── infrastructure/        adapters que implementam as portas
│   │   ├── sicoobHttp.js      ← services/sicoobClient.js
│   │   ├── whatsappGraph.js   ← services/graph-api.js
│   │   ├── sessaoRedis.js     ← services/redis.js
│   │   └── telemetriaHttp.js  ← services/interacaoClient.js
│   ├── interface/             entrada HTTP
│   │   ├── webhookRouter.js   ← rotas de app.js
│   │   ├── paginasRouter.js   ← rotas estáticas
│   │   └── payloadWhatsApp.js ← services/message.js + status.js
│   └── composicao.js          composition root: o único lugar que vê tudo
├── web/                       componente 2 — frontend (era public/)
├── python/sicoob_service/     componente 3 — intacto
└── .arch.json                 fronteiras verificadas no CI
```

Regra de dependência (setas só para dentro): `domain` não importa ninguém; `application`
importa só `domain`; `infrastructure` e `interface` importam `domain` + `application` e nunca
um ao outro; ninguém importa `interface`. O wiring vive em `composicao.js`, fora das camadas.

## Responsabilidade única — para onde vai cada pedaço do `conversation.js`

| O que faz hoje | Vai para |
|---|---|
| `cpfValido` | `domain/cpf.js` |
| ordenar, cortar em 10, resolver índice da seleção | `domain/boleto.js` |
| decidir botões vs. lista, montar títulos e limites da Meta | `domain/boleto.js` (já é `boletoView.js`) |
| interpretar resposta do Sicoob (erro / vazio / lista) | `application/consultarPorCpf.js` |
| distinguir "em dia" de "CPF não cadastrado" | `application/consultarPorCpf.js` |
| roteamento por estado da conversa | `interface/webhookRouter.js` |
| enviar mensagem, upload de PDF | `infrastructure/whatsappGraph.js` |
| ler/gravar sessão | `infrastructure/sessaoRedis.js` |
| registrar interação | `infrastructure/telemetriaHttp.js` |

## Fases (cada uma publicável, testes verdes)

**Fase 1 — domínio puro.** Extrair `cpfValido` para `api/domain/cpf.js` e promover
`boletoView.js` a `api/domain/boleto.js`. Ambos já são puros, então é movimentação com
`require` novo.
*Efeito colateral bom:* `test/cpf.test.js` hoje lê `conversation.js` como **texto** e casa
`/function cpfValido[\s\S]+?^}/m` para não puxar o Redis. Com a função em um módulo puro, o
teste passa a fazer `require` normal — a gambiarra morre. **Este teste quebra nesta fase e
precisa ser reescrito junto.**

**Fase 2 — portas e adapters.** Definir as portas em `domain/portas/` e mover os quatro
clientes para `infrastructure/`. Aqui some o efeito colateral do Redis: `sessaoRedis.js`
passa a exportar `criarSessao(config)` em vez de conectar ao ser importado.

**Fase 3 — casos de uso.** Quebrar `conversation.js` em quatro arquivos de `application/`,
cada um recebendo as portas por parâmetro. É a fase que entrega "responsabilidade única" e a
maior parte do risco — fatiar em quatro commits, um caso de uso por vez.

**Fase 4 — interface e composition root.** `app.js` vira `interface/*Router.js` +
`composicao.js`. `app.js` na raiz permanece como ponto de entrada fino (`require('./api/composicao')`).

**Fase 5 — frontend.** `public/` → `web/`. Atualizar `Dockerfile`, as rotas de `sendFile` e o
CI (que hoje faz `find public -name '*.js'`).

**Fase 6 — linter bloqueante.** `.arch.json` + `boundary_lint.py` no CI, falhando o build
quando uma seta apontar para fora.

## Armadilhas que este plano precisa respeitar

- **O `Dockerfile` copia apenas `app.js`, `services/` e `public/`.** Criar `api/` e `web/` sem
  atualizá-lo faz o container subir sem o código novo. Vale para as fases 1 a 5.
- **`test/cpf.test.js` lê código-fonte como texto** — quebra na fase 1, de propósito.
- **O CI verifica `find public -name '*.js'` e `GET /app.js` → 404.** Ambos mudam na fase 5;
  a proteção precisa continuar existindo apontando para `web/`.
- **O smoke test do CI espera `ASSUSA` em `/` e `Servidor ativo` em `/status`.** As rotas
  mudam de arquivo na fase 4, não de comportamento.
- **Push em `main` publica.** Cada fase entra sozinha, com os testes verdes.

## `.arch.json` para este projeto

O `sample.arch.json` da skill não cobre as dependências daqui. A lista de imports proibidos no
domínio precisa incluir o que o projeto realmente usa:

```
express, body-parser, redis, facebook-nodejs-business-sdk, dotenv, node-fetch
```

Verificado que `boundary_lint.py` entende `require()` de CommonJS e acusa violação de direção
de dependência — testado antes de escrever este plano.

## Verificação

1. `npm test` verde ao fim de **cada** fase (hoje 89) — sem Redis instalado, como é a regra.
2. `python3 boundary_lint.py --root api --config .arch.json` → exit 0.
3. `docker compose build web && docker compose up -d --no-deps web`, e então o smoke test do
   CI reproduzido: `ASSUSA` em `/`, `Servidor ativo` em `/status`, `/app.js` → 404.
4. Fluxo ponta a ponta na stack (CPF → lista → entrega → "ver outras contas"), como já foi
   feito nas mudanças anteriores.

## Fora de escopo

Três deployments separados; camadas no serviço Python; troca de framework; qualquer mudança
de comportamento visível ao cliente. Esta é uma migração estrutural — o bot deve se comportar
exatamente igual do começo ao fim.
