# Árvore de Fluxo de Mensagens — Bot WhatsApp Assusa

Documento completo de todos os caminhos possíveis de conversa, desde o
recebimento de uma mensagem até a resposta final ao usuário.

---

## Visão geral — Máquina de estados

O bot mantém um estado por número de telefone no Redis. Toda mensagem
recebida é processada de acordo com o estado atual do remetente.

```
Estados possíveis no Redis:
  (sem estado)               → usuário inativo / novo
  aguardando_cpf             → bot aguarda o CPF do usuário
  aguardando_selecao_boleto  → bot aguarda o usuário escolher um boleto
```

---

## Árvore completa de fluxo

```
MENSAGEM RECEBIDA
│
├── [status: delivered / read]
│   ├── messageId NÃO está no cache Redis → ignora
│   └── messageId ESTÁ no cache Redis
│       └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (3 botões)
│
└── [message]
    │
    ├─── Estado Redis = "aguardando_cpf"
    │    └── handleCpfRecebido()
    │        │
    │        ├── CPF tem menos de 11 dígitos
    │        │   ├── grava interação: CPF_INVALIDO
    │        │   └── ✉ "Não encontrei uma conta ativa com esse CPF..."
    │        │       [estado permanece aguardando_cpf]
    │        │
    │        └── CPF tem exatamente 11 dígitos
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
    │                │   └── ✉ "Encontrei X boleto(s)..." + botões [Venc. DATA]
    │                │
    │                └── mais de 3 boletos encontrados
    │                    ├── ✉ "Você possui X boletos em aberto. Exibindo os 3 mais antigos..."
    │                    ├── ordena, pega os 3 mais antigos, salva no Redis
    │                    ├── setEstado: aguardando_selecao_boleto
    │                    ├── grava interação: BOLETOS_LISTADOS
    │                    └── ✉ "Encontrei X boleto(s)..." + botões [Venc. DATA] (máx. 3)
    │
    ├─── Estado Redis = "aguardando_selecao_boleto"
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
    │                        │       caption: vencimento | valor | linha digitável | PIX
    │                        │
    │                        └── upload FALHOU (erro na Meta API)
    │                            └── ✉ caption como texto simples (fallback sem PDF)
    │                            [sem gravar interação — sem ramificação no código]
    │
    └─── Sem estado / estado desconhecido
         └── dispatch por message.type
             │
             ├── "assusa-segunda-via" (botão clicado)
             │   ├── grava interação: SEGUNDA_VIA_INICIADA
             │   ├── setEstado: aguardando_cpf
             │   └── ✉ "Para emitir a 2ª via da sua conta, preciso do seu CPF..."
             │
             ├── "assusa-falar-atendente" (botão clicado)
             │   ├── grava interação: ATENDENTE_SOLICITADO
             │   └── ✉ "Nossos atendentes estão disponíveis de segunda a sexta..."
             │
             ├── "assusa-horario-funcionamento" (botão clicado)
             │   ├── grava interação: HORARIO_CONSULTADO
             │   └── ✉ "Nosso atendimento funciona de segunda a sexta..."
             │
             └── qualquer outra mensagem (texto livre, áudio, imagem, etc.)
                 ├── grava interação: MENU_EXIBIDO
                 └── ✉ "Olá! Bem-vindo à Assusa..." + menu (3 botões)
```

---

## Detalhamento de cada estado

### Estado: `(sem estado)`

Usuário novo ou inativo. Qualquer mensagem recebida aciona o dispatcher
no `message.type`. Botões de menu têm IDs fixos definidos em `constants.js`.

| `message.type` recebido | Ação |
|---|---|
| `assusa-segunda-via` | Inicia fluxo de 2ª via |
| `assusa-falar-atendente` | Envia contato do atendente |
| `assusa-horario-funcionamento` | Envia horário de funcionamento |
| qualquer outro valor | Exibe menu principal |

---

### Estado: `aguardando_cpf`

Ativado após o usuário clicar em "2ª via de conta". O bot aguarda uma
mensagem de texto com o CPF.

| Condição | Resultado |
|---|---|
| Texto com < 11 dígitos (após remover não-numéricos) | Erro — estado **não** é limpo |
| Texto com = 11 dígitos | Consulta a API do Sicoob |
| Botão ou qualquer não-texto | Processado como se fosse CPF inválido |

> O estado só é limpo em caso de sucesso (lista retornada) ou erro de serviço.
> CPF inválido mantém o estado, permitindo nova tentativa sem reiniciar o fluxo.

---

### Estado: `aguardando_selecao_boleto`

Ativado após listar boletos com sucesso. O bot aguarda o usuário clicar
em um dos botões `boleto-0`, `boleto-1` ou `boleto-2`.

| Condição | Resultado |
|---|---|
| `boleto-N` válido com boletos no cache | Solicita segunda via ao Sicoob |
| `boleto-N` mas sem cache no Redis | Erro de serviço — estado limpo |
| Qualquer outra mensagem | Tratado como estado inativo (ver acima) |

> O estado **sempre** é limpo ao final desta etapa, seja por sucesso ou erro.

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
            └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (3 botões)
```

> O follow-up só é enviado para mensagens marcadas previamente com
> `markMessageForFollowUp()`. Atualmente nenhum caminho do código chama
> essa função, então o follow-up está implementado mas inativo.

---

## Interações gravadas no PostgreSQL

Toda ação significativa grava uma linha na tabela de interações via
`/interno/interacao`. Permite auditoria e monitoramento do uso real.

```
SEGUNDA_VIA_INICIADA   → usuário clicou em 2ª via
CPF_INVALIDO           → CPF com dígitos ≠ 11
ERRO_SERVICO           → falha em listar_boletos ou segunda_via
NENHUM_BOLETO          → Sicoob retornou lista vazia
BOLETOS_LISTADOS       → boletos exibidos com sucesso { total, exibidos }
BOLETO_SELECIONADO     → usuário escolheu um boleto { idx, dataVencimento }
PDF_ENTREGUE           → PDF enviado com sucesso { dataVencimento, valor }
ATENDENTE_SOLICITADO   → usuário clicou em falar com atendente
HORARIO_CONSULTADO     → usuário clicou em horário
MENU_EXIBIDO           → mensagem desconhecida → menu enviado
```

---

## Mensagens enviadas ao usuário

| Constante | Texto |
|---|---|
| `APP_DEFAULT_MESSAGE` | "Olá! Bem-vindo à Assusa Distribuidora de Água. Como podemos te ajudar hoje?" |
| `APP_TRY_ANOTHER_MESSAGE` | "Posso te ajudar com mais alguma coisa?" |
| `MSG_SOLICITAR_CPF` | "Para emitir a 2ª via da sua conta, preciso do seu CPF ou número de contrato. Por favor, envie apenas os números." |
| `MSG_SEGUNDA_VIA_ERRO` | "Não encontrei uma conta ativa com esse CPF. Verifique os dados e tente novamente, ou fale com nosso atendente." |
| `MSG_SEGUNDA_VIA_ERRO_SERVICO` | "Nosso serviço está temporariamente indisponível. Tente novamente em alguns instantes ou ligue: (31) 3624-8550." |
| `MSG_NENHUM_BOLETO` | "Não encontrei boletos em aberto para este CPF. Se achar que é um engano, fale com nosso atendente." |
| `MSG_AVISO_MUITOS_BOLETOS` | "Você possui {TOTAL} boletos em aberto. Exibindo os 3 mais antigos — para os demais, fale com nosso atendente: (31) 3624-8550." |
| `MSG_SELECIONAR_BOLETO` | "Encontrei {TOTAL} boleto(s) em aberto. Selecione o que deseja pagar:" |
| `MSG_BOLETO_DETALHES` | "Vencimento: {DATA} \| Valor: R$ {VALOR}\n\nLinha digitável:\n{LINHA_DIGITAVEL}\n\nPIX copia e cola:\n{QR_CODE}" |
| `MSG_REDIRECIONAMENTO_ATENDENTE` | "Nossos atendentes estão disponíveis de segunda a sexta, das 8h às 18h. Para falar com um atendente agora, ligue: (31)3624-8550." |
| `MSG_HORARIO_FUNCIONAMENTO` | "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h." |

---

## Diagrama de estados simplificado

```
         qualquer msg
              │
        ┌─────▼──────┐
        │ sem estado │◄────────────────────────────────────────┐
        └─────┬──────┘                                         │
              │                                                 │
    ┌─────────┼──────────────────┐                             │
    │         │                  │                             │
 2ª via   atendente           horário                         │
    │      (fim)               (fim)                           │
    ▼                                                          │
┌───────────────┐   CPF inválido (loop)                        │
│aguardando_cpf │──────────────────────────────────────┐       │
└──────┬────────┘                                      │       │
       │ CPF válido                                    │       │
       ▼                                               │       │
  [listar API]                                         │       │
       │                                               │       │
  ┌────┴───────────────────────────┐                  │       │
  │ erro serviço    │  0 boletos   │  1–3 boletos      │       │
  │    (fim)        │   (fim)      │      │             │       │
  └─────────────────┴──────────────┘      ▼             │       │
                                ┌─────────────────────┐│       │
                                │aguardando_selecao   ││       │
                                └──────────┬──────────┘│       │
                                           │ boleto-N  │       │
                                           ▼           │       │
                                      [2ª via API]     │       │
                                           │           │       │
                            ┌──────────────┴───────┐   │       │
                            │ erro / sem PDF  │ PDF │   │       │
                            │    (fim)        │  ✓  │   │       │
                            └─────────────────┴─────┘   │       │
                                                  (fim) └───────┘
```

> `(fim)` = estado limpo, usuário volta para `sem estado` e pode recomeçar.
