# Árvore de Fluxo de Mensagens — Bot WhatsApp Assusa

Documento completo de todos os caminhos possíveis de conversa, desde o
recebimento de uma mensagem até a resposta final ao usuário.

---

## Visão geral — Máquina de estados

O bot mantém um estado por número de telefone no Redis (TTL = 600 s / 10 min).
Toda mensagem recebida é processada de acordo com o estado atual do remetente.

```
Estados possíveis no Redis:
  (sem estado)               → usuário inativo / novo
  aguardando_cpf             → bot aguarda o CPF do usuário
  aguardando_selecao_boleto  → bot aguarda o usuário escolher um boleto
```

> Palavras-chave de saída — válidas em **qualquer** estado e a qualquer momento:
> `menu` · `sair` · `voltar` · `cancelar` · `inicio` (sem acento) / `início`
> A detecção é case-insensitive e ignora acentos. Aplicada apenas a texto livre
> (`message.type === "unknown"`), não a cliques de botão.

---

## Árvore completa de fluxo

```
MENSAGEM RECEBIDA
│
├── [status: delivered / read]
│   ├── messageId NÃO está no cache Redis → ignora
│   └── messageId ESTÁ no cache Redis
│       └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (2 botões)
│
└── [message]
    │
    ├─── Palavra-chave de saída (qualquer estado, texto livre)
    │    ├── limpa estado e boletos do Redis
    │    ├── grava interação: FLUXO_CANCELADO
    │    └── ✉ menu principal (2 botões) + instruções de saída
    │
    ├─── Estado Redis = "aguardando_cpf"
    │    │
    │    ├── Botão de menu recebido (assusa-segunda-via, assusa-falar-atendente)
    │    │   └── limpa estado → continua no dispatch abaixo
    │    │
    │    └── handleCpfRecebido()
    │        │
    │        ├── CPF com dígitos inválidos (< 11, > 11 ou dígitos verificadores errados)
    │        │   ├── grava interação: CPF_INVALIDO
    │        │   └── ✉ "Não encontrei uma conta ativa com esse CPF..."
    │        │       [estado permanece aguardando_cpf — usuário pode tentar de novo]
    │        │
    │        └── CPF válido (11 dígitos + dígitos verificadores corretos)
    │            ├── ✉ "Aguarde, estou consultando seus boletos..."  ← loading
    │            └── → listarBoletos(cpf) [Sicoob API]
    │                │
    │                ├── ERRO de rede / timeout
    │                │   ├── grava interação: ERRO_SERVICO (etapa: listar_boletos)
    │                │   ├── ✉ "Nosso serviço está temporariamente indisponível..."
    │                │   └── limpa estado Redis
    │                │
    │                ├── ERRO da API (result.error ou status ≥ 400)
    │                │   ├── grava interação: ERRO_SERVICO (etapa: listar_boletos)
    │                │   ├── ✉ "Nosso serviço está temporariamente indisponível..."
    │                │   └── limpa estado Redis
    │                │
    │                ├── 0 boletos encontrados
    │                │   ├── grava interação: NENHUM_BOLETO
    │                │   ├── ✉ "Não encontrei boletos em aberto para este CPF..."
    │                │   └── limpa estado Redis
    │                │
    │                ├── 1 a 3 boletos encontrados
    │                │   ├── ordena por dataVencimento (mais antigo primeiro)
    │                │   ├── salva boletos no Redis
    │                │   ├── setEstado: aguardando_selecao_boleto
    │                │   ├── grava interação: BOLETOS_LISTADOS
    │                │   └── ✉ "Encontrei X boleto(s) em aberto no período dos últimos 35 dias..."
    │                │       + botões com status: "Vence DD/MM" ou "! Vencido DD/MM"
    │                │
    │                └── mais de 3 boletos encontrados
    │                    ├── ✉ "Você possui X boletos em aberto. Exibindo os 3 mais antigos..."
    │                    ├── ordena, pega os 3 mais antigos, salva no Redis
    │                    ├── setEstado: aguardando_selecao_boleto
    │                    ├── grava interação: BOLETOS_LISTADOS
    │                    └── ✉ "Encontrei X boleto(s)..." + botões (máx. 3)
    │
    ├─── Estado Redis = "aguardando_selecao_boleto"
    │    │
    │    ├── Botão de menu recebido (assusa-segunda-via, assusa-falar-atendente)
    │    │   └── limpa estado e boletos → continua no dispatch abaixo
    │    │
    │    └── handleSelecaoBoleto()
    │        │
    │        ├── botão inválido OU sem boletos no cache Redis
    │        │   ├── ✉ "Nosso serviço está temporariamente indisponível..."
    │        │   └── limpa estado e boletos do Redis
    │        │
    │        └── boleto-0 / boleto-1 / boleto-2
    │            ├── grava interação: BOLETO_SELECIONADO
    │            └── → segundaViaBoleto(linhaDigitavel) [Sicoob API]
    │                │
    │                ├── ERRO de rede / timeout / sem pdfBoleto na resposta
    │                │   ├── grava interação: ERRO_SERVICO (etapa: segunda_via)
    │                │   └── ✉ "Nosso serviço está temporariamente indisponível..."
    │                │
    │                └── pdfBoleto presente (base64)
    │                    └── → uploadMedia(pdfBuffer) [Meta Graph API]
    │                        │
    │                        ├── upload com SUCESSO
    │                        │   ├── grava interação: PDF_ENTREGUE
    │                        │   └── ✉ documento PDF "boleto.pdf"
    │                        │       caption: vencimento DD/MM/YYYY | valor R$ X,XX
    │                        │               linha digitável | PIX copia e cola
    │                        │
    │                        └── upload FALHOU (erro na Meta API)
    │                            └── ✉ caption como texto simples (fallback sem PDF)
    │
    └─── Sem estado / estado desconhecido
         └── dispatch por message.type
             │
             ├── "assusa-segunda-via" (botão clicado)
             │   ├── grava interação: SEGUNDA_VIA_INICIADA
             │   ├── setEstado: aguardando_cpf
             │   └── ✉ "Para enviar sua 2ª via, preciso do seu CPF..."
             │
             ├── "assusa-falar-atendente" (botão clicado)
             │   ├── grava interação: ATENDENTE_SOLICITADO
             │   └── ✉ "Nossos atendentes estão disponíveis de segunda a sexta..."
             │
             ├── "assusa-horario-funcionamento" (botão legado — não exibido no menu)
             │   ├── grava interação: HORARIO_CONSULTADO
             │   └── ✉ "Nosso atendimento funciona de segunda a sexta..."
             │
             └── qualquer outra mensagem (texto livre, áudio, imagem, etc.)
                 ├── grava interação: MENU_EXIBIDO
                 └── ✉ "Olá! Bem-vindo à Assusa..." + menu (2 botões)
                       + instrução "digite menu, sair ou voltar para retornar"
```

---

## Detalhamento de cada estado

### Estado: `(sem estado)`

Usuário novo ou inativo. Qualquer mensagem aciona o dispatcher no `message.type`.
Botões de menu têm IDs fixos definidos em `constants.js`.

| `message.type` recebido | Ação |
|---|---|
| `assusa-segunda-via` | Inicia fluxo de 2ª via |
| `assusa-falar-atendente` | Envia contato do atendente |
| `assusa-horario-funcionamento` | Envia horário (botão legado — não aparece no menu) |
| qualquer outro valor | Exibe menu principal (2 botões) |

---

### Estado: `aguardando_cpf`

Ativado após o usuário clicar em "2ª via de conta". O bot aguarda CPF.

| Condição | Resultado |
|---|---|
| Texto com palavra-chave de saída | Volta ao menu — estado limpo |
| Botão de menu (`assusa-segunda-via` etc.) | Estado limpo → dispatch normal |
| CPF com dígitos verificadores inválidos | Erro — estado **não** é limpo (pode tentar de novo) |
| CPF válido (11 dígitos + verificadores) | Consulta API do Sicoob |

> A validação de CPF inclui verificação dos dois dígitos verificadores (algoritmo
> módulo 11), bloqueando sequências inválidas como 000.000.000-00.

---

### Estado: `aguardando_selecao_boleto`

Ativado após listar boletos com sucesso. O bot aguarda clicar em um botão.

| Condição | Resultado |
|---|---|
| Texto com palavra-chave de saída | Volta ao menu — estado e boletos limpos |
| Botão de menu (`assusa-segunda-via` etc.) | Estado e boletos limpos → dispatch normal |
| `boleto-N` válido com boletos no cache | Solicita segunda via ao Sicoob |
| `boleto-N` mas sem cache no Redis | Erro de serviço — estado limpo |

> O estado **sempre** é limpo ao final desta etapa, seja por sucesso ou erro.

---

## Formatação de data e valor

Os valores são formatados no padrão brasileiro antes de enviar ao usuário:

| Campo | Formato | Exemplo |
|---|---|---|
| Data completa (`dataVencimento`) | `DD/MM/YYYY` | `20/05/2026` |
| Data curta (título do botão) | `DD/MM` | `20/05` |
| Valor monetário | `R$ X.XXX,XX` | `R$ 1.234,56` |

Os títulos dos botões de boleto indicam o status de vencimento:

| Situação | Título do botão | Exemplo |
|---|---|---|
| Ainda não venceu | `Vence DD/MM` | `Vence 30/06` |
| Já venceu | `! Vencido DD/MM` | `! Vencido 20/05` |

> O prefixo `!` substitui `⚠` para evitar problemas de contagem de caracteres
> na Meta API (limite de 20 caracteres por título de botão).

---

## Fluxo de segunda via — detalhe interno

```
handleSelecaoBoleto()
    │
    ├── busca boleto[idx] do Redis
    ├── chama sicoobClient.segundaViaBoleto({
    │     numeroCliente: SICOOB_NUMERO_CLIENTE,   ← env: 1964895
    │     codigoModalidade: 1,
    │     linhaDigitavel: boleto.linhaDigitavel   ← vem do listar
    │   })
    │
    └── recebe resultado.pdfBoleto (base64 ~86KB)
        │
        ├── Buffer.from(pdfBoleto, "base64")
        └── GraphApi.uploadMedia(phoneNumberId, pdfBuffer)
            └── GraphApi.messageWithDocument(mediaId, "boleto.pdf", caption)
                caption = "Vencimento: DD/MM/YYYY | Valor: R$ X,XX
                           \n\nLinha digitável:\n...
                           \n\nPIX copia e cola:\n..."
```

> O `nossoNumero` **não é usado** no fluxo do WhatsApp. O identificador
> transitado entre etapas é sempre a `linhaDigitavel`.

---

## Fluxo de status (entrega e leitura)

```
STATUS RECEBIDO (delivered / read)
    │
    ├── status != "delivered" && status != "read" → ignora
    │
    └── Cache.remove(messageId)
        ├── messageId NÃO estava no cache → ignora
        └── messageId ESTAVA no cache
            └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (2 botões)
```

> O follow-up só é enviado para mensagens marcadas com `markMessageForFollowUp()`.
> Atualmente nenhum caminho do código chama essa função — o follow-up está
> implementado mas inativo.

---

## Interações gravadas no PostgreSQL

Toda ação significativa grava uma linha na tabela de interações via
`/interno/interacao`. Permite auditoria e monitoramento do uso real.

```
SEGUNDA_VIA_INICIADA   → usuário clicou em 2ª via
CPF_INVALIDO           → CPF com dígitos inválidos (formato ou verificadores)
ERRO_SERVICO           → falha em listar_boletos ou segunda_via
NENHUM_BOLETO          → Sicoob retornou lista vazia
BOLETOS_LISTADOS       → boletos exibidos com sucesso { total, exibidos }
BOLETO_SELECIONADO     → usuário escolheu um boleto { idx, dataVencimento }
PDF_ENTREGUE           → PDF enviado com sucesso { dataVencimento, valor }
ATENDENTE_SOLICITADO   → usuário clicou em falar com atendente
HORARIO_CONSULTADO     → usuário clicou em horário (botão legado)
MENU_EXIBIDO           → mensagem desconhecida → menu enviado
FLUXO_CANCELADO        → usuário digitou palavra-chave de saída (menu/sair/voltar/...)
```

---

## Menu principal

O menu exibe **2 botões** (terceiro slot livre):

| ID | Texto exibido |
|---|---|
| `assusa-segunda-via` | 2ª via de conta |
| `assusa-falar-atendente` | Falar com atendente |

O botão `assusa-horario-funcionamento` foi removido do menu mas seu handler
permanece no código para compatibilidade com mensagens antigas em trânsito.

---

## Mensagens enviadas ao usuário

| Constante | Texto |
|---|---|
| `APP_DEFAULT_MESSAGE` | "Olá! Bem-vindo à Assusa Distribuidora de Água. Como podemos te ajudar hoje?\n\nA qualquer momento, digite **menu**, **sair** ou **voltar** para retornar ao início." |
| `APP_TRY_ANOTHER_MESSAGE` | "Posso te ajudar com mais alguma coisa?" |
| `MSG_SOLICITAR_CPF` | "Para enviar sua 2ª via, preciso do seu CPF.\n\nDigite os 11 números do CPF. Pode enviar com ou sem pontos.\n\nExemplos válidos: **123.456.789-00** / **12345678900**" |
| `MSG_CONSULTANDO_BOLETOS` | "Aguarde, estou consultando seus boletos..." |
| `MSG_SELECIONAR_BOLETO` | "Encontrei {TOTAL} boleto(s) em aberto no período dos últimos 35 dias.\n\nSelecione o que deseja pagar:" |
| `MSG_AVISO_MUITOS_BOLETOS` | "Você possui {TOTAL} boletos em aberto. Exibindo os 3 mais antigos — para os demais, fale com nosso atendente: (31) 3624-8550." |
| `MSG_SEGUNDA_VIA_ERRO` | "Não encontrei uma conta ativa com esse CPF. Verifique os dados e tente novamente, ou fale com nosso atendente." |
| `MSG_SEGUNDA_VIA_ERRO_SERVICO` | "Nosso serviço está temporariamente indisponível. Tente novamente em alguns instantes ou ligue: (31) 3624-8550." |
| `MSG_NENHUM_BOLETO` | "Não encontrei boletos em aberto para este CPF. Se achar que é um engano, fale com nosso atendente." |
| `MSG_BOLETO_DETALHES` | "Vencimento: DD/MM/YYYY \| Valor: R$ X,XX\n\nLinha digitável:\n...\n\nPIX copia e cola:\n..." |
| `MSG_REDIRECIONAMENTO_ATENDENTE` | "Nossos atendentes estão disponíveis de segunda a sexta, das 8h às 18h. Para falar com um atendente agora, ligue: (31)3624-8550." |
| `MSG_HORARIO_FUNCIONAMENTO` | "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h." |

---

## Diagrama de estados simplificado

```
         qualquer msg
              │
    ┌─────────▼──────────┐   palavra-chave saída
    │    sem estado      │◄──────────────────────────────────────┐
    └────────┬───────────┘                                        │
             │                                                    │
   ┌─────────┼────────────┐                                       │
   │         │            │                                       │
2ª via   atendente     horário                                    │
   │      (fim)         (fim)                                     │
   ▼                                                             │
┌──────────────┐  CPF inválido (loop)                            │
│aguardando_cpf│──────────────────────────────────────┐          │
└──────┬───────┘                                      │          │
       │ CPF válido                                   │          │
       │ ✉ "Aguarde..."                               │          │
       ▼                                              │          │
  [listar API]                                        │          │
       │                                              │          │
  ┌────┴──────────────────────┐                       │          │
  │ erro / 0 boletos  │ 1–3 boletos                   │          │
  │      (fim)        │    │                           │          │
  └───────────────────┘    ▼                           │          │
                 ┌──────────────────────┐              │          │
                 │aguardando_selecao    │              │          │
                 └──────────┬───────────┘              │          │
                            │ boleto-N                 │          │
                            ▼                          │          │
                       [2ª via API]                    │          │
                            │                          │          │
               ┌────────────┴──────┐                   │          │
               │ erro / sem PDF  PDF│                   │          │
               │    (fim)       ✓  │                   │          │
               └────────────────────┘                  │          │
                            (fim) ──────────────────────┘          │
                                                                    │
         palavra-chave (em qualquer estado) ────────────────────────┘
```

> `(fim)` = estado limpo, usuário volta para `sem estado` e pode recomeçar.
