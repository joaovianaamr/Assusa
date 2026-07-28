# Árvore de Fluxo de Mensagens — Bot WhatsApp Assusa

Documento completo de todos os caminhos possíveis de conversa, desde o
recebimento de uma mensagem até a resposta final ao usuário.

---

## Visão geral — Máquina de estados

O bot mantém um estado por número de telefone no Redis (TTL = 1800 s / 30 min por
padrão, configurável via `ESTADO_TTL_SECONDS`, deslizante — renovado a cada interação).
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
│       └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (1 botão)
│
└── [message]
    │
    ├─── Palavra-chave de saída (qualquer estado, texto livre)
    │    ├── limpa estado e boletos do Redis
    │    ├── grava interação: FLUXO_CANCELADO
    │    └── ✉ menu principal (1 botão) + instruções de saída
    │
    ├─── Botão "Ver outras contas" (assusa-ver-outras) — QUALQUER estado
    │    │   [tratado antes da máquina de estados: dentro de
    │    │    aguardando_selecao_boleto cairia em handleSelecaoBoleto
    │    │    e viraria "não entendi sua resposta"]
    │    │
    │    ├── há lista no Redis → reexibe do CACHE (0 chamadas ao Sicoob)
    │    │   ├── grava interação: LISTA_REEXIBIDA
    │    │   └── renova o TTL — a sessão NÃO é descartada
    │    │
    │    └── cache vazio (TTL expirou)
    │        ├── grava interação: SESSAO_EXPIRADA
    │        └── ✉ "não tenho mais sua lista..." + botão [Voltar ao menu]
    │
    ├─── Estado Redis = "aguardando_cpf"
    │    │
    │    ├── Botão de menu recebido (assusa-segunda-via, assusa-horario-funcionamento,
    │    │                        assusa-menu)
    │    │   └── limpa estado → continua no dispatch abaixo
    │    │
    │    └── handleCpfRecebido()
    │        │
    │        ├── CPF com dígitos inválidos (< 11, > 11 ou dígitos verificadores errados)
    │        │   ├── grava interação: CPF_INVALIDO
    │        │   └── ✉ "Esse CPF parece incompleto ou incorreto..." + botão [Voltar ao menu]
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
    │                ├── 0 boletos em aberto  → responderSemBoletosEmAberto()
    │                │   │   [refaz listarBoletos SEM codigoSituacao, para separar
    │                │   │    "cliente em dia" de "CPF fora do cadastro"]
    │                │   │
    │                │   ├── histórico com boletos (cliente existe, está em dia)
    │                │   │   ├── grava interação: CLIENTE_EM_DIA
    │                │   │   └── ✉ "Boa notícia: não há contas em aberto no CPF 123.***.**9-00..." + botão
    │                │   │
    │                │   ├── histórico vazio (CPF não é de cliente)
    │                │   │   ├── grava interação: CPF_NAO_ENCONTRADO
    │                │   │   └── ✉ "Não localizei esse CPF no cadastro da Assusa..." + botão [Voltar ao menu]
    │                │   │
    │                │   ├── consulta de histórico falhou → texto genérico
    │                │   │   ├── grava interação: NENHUM_BOLETO
    │                │   │   └── ✉ "Não encontrei contas em aberto nesse CPF..."
    │                │   │
    │                │   └── limpa estado Redis
    │                │
    │                └── 1 ou mais boletos → apresentarBoletos()
    │                    ├── ordena por dataVencimento (mais antigo primeiro)
    │                    ├── corta em 10 (teto de linhas da lista interativa)
    │                    │   └── se havia mais: ✉ "Você possui X contas em aberto.
    │                    │       Estou mostrando as 10 mais antigas..."
    │                    ├── enriquece TODAS com o valor atualizado (2ª via sem PDF)
    │                    ├── grava interação: BOLETOS_LISTADOS
    │                    │
    │                    ├── 1 a 3 contas → ✉ mensagem de BOTÕES (limite da Meta)
    │                    │   "Encontrei X conta(s) em aberto..." + até 3 botões
    │                    │
    │                    ├── 4 ou mais contas → ✉ LISTA INTERATIVA
    │                    │   "Encontrei X contas... Toque em *Ver minhas contas*"
    │                    │   + até 10 linhas (título: "N) Conta DD/MM/AAAA",
    │                    │     descrição: "Valor atualizado: R$ X,XX")
    │                    │
    │                    ├── Meta RECUSOU a mensagem interativa → fallback em texto
    │                    │   ├── grava interação: SELECAO_FALLBACK_TEXTO
    │                    │   └── ✉ lista enumerada + "Responda com o número da conta"
    │                    │
    │                    ├── nem o texto saiu → limpa estado e boletos
    │                    │   [o cliente não pode ficar preso num estado cuja
    │                    │    mensagem ele nunca recebeu]
    │                    │
    │                    └── enviou → salva boletos + setEstado: aguardando_selecao_boleto
    │                        [gravado DEPOIS do envio, nunca antes]
    │
    ├─── Estado Redis = "aguardando_selecao_boleto"
    │    │
    │    ├── Botão de menu recebido (assusa-segunda-via, assusa-horario-funcionamento,
    │    │                        assusa-menu)
    │    │   └── limpa estado e boletos → continua no dispatch abaixo
    │    │
    │    └── handleSelecaoBoleto()
    │        │   [view.resolverIndiceSelecao aceita três formas de resposta:
    │        │    clique de botão, toque em item de lista (ambos "boleto-N")
    │        │    e o número digitado pelo cliente ("1", "2", ...)]
    │        │
    │        ├── sem boletos no cache Redis (TTL expirou)
    │        │   ├── ✉ "Nosso sistema está fora do ar neste momento..."
    │        │   └── limpa estado e boletos do Redis
    │        │
    │        ├── resposta não reconhecida (texto solto, número fora do intervalo)
    │        │   ├── ✉ "Não entendi sua resposta. Responda com o número..." + botão [Voltar ao menu]
    │        │   └── mantém a sessão e renova o TTL (cliente tenta de novo)
    │        │
    │        └── seleção válida (boleto-0 … boleto-9, ou número digitado)
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
    │                        │   ├── ✉ documento PDF "boleto.pdf"
    │                        │       caption: vencimento DD/MM/YYYY | valor R$ X,XX
    │                        │               linha digitável | PIX copia e cola
    │                        │
    │                        ├── upload FALHOU (erro na Meta API)
    │                        │   └── ✉ caption como texto simples (fallback sem PDF)
    │                        │
    │                        └── FECHAMENTO (fecharEntrega) — sempre, após entregar
    │                            ├── mantém estado + boletos e renova o TTL
    │                            ├── 2+ contas na sessão:
    │                            │   ✉ "Pronto! Sua conta de DD/MM/AAAA foi enviada."
    │                            │   + [Ver outras contas] [Voltar ao menu]
    │                            └── 1 conta só:
    │                                ✉ "Pronto! ... Posso ajudar com mais alguma coisa?"
    │                                + [Voltar ao menu]
    │
    └─── Sem estado / estado desconhecido
         └── dispatch por message.type
             │
             ├── "assusa-segunda-via" (botão clicado)
             │   ├── grava interação: SEGUNDA_VIA_INICIADA
             │   ├── setEstado: aguardando_cpf
             │   └── ✉ "Para enviar sua 2ª via, preciso do seu CPF..."
             │
             ├── "assusa-menu" (botão "Voltar ao menu" das mensagens de fim de fluxo)
             │   ├── grava interação: MENU_VIA_BOTAO
             │   └── ✉ "Olá! Bem-vindo à Assusa..." + menu (1 botão)
             │
             ├── "assusa-horario-funcionamento" (botão legado — não exibido no menu)
             │   ├── grava interação: HORARIO_CONSULTADO
             │   └── ✉ "Nosso atendimento funciona de segunda a sexta..."
             │
             └── qualquer outra mensagem (texto livre, áudio, imagem, etc.)
                 ├── grava interação: MENU_EXIBIDO
                 └── ✉ "Olá! Bem-vindo à Assusa..." + menu (1 botão)
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
| `assusa-horario-funcionamento` | Envia horário (botão legado — não aparece no menu) |
| qualquer outro valor | Exibe menu principal (1 botão) |

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
>
> **Qualquer pontuação é aceita.** `handleCpfRecebido` faz `replace(/\D/g, "")` antes
> de validar, então ponto, hífen, espaço ou nenhuma pontuação funcionam igual — e até
> uma frase com o número dentro ("meu cpf e 111.444.777-35") passa. Os três formatos
> citados em `MSG_SOLICITAR_CPF_2` são exemplos, não uma lista fechada — o caso da frase
> ficou fora da mensagem de propósito, para não confundir o cliente.

---

### Estado: `aguardando_selecao_boleto`

Ativado após listar boletos com sucesso. O bot aguarda a escolha de uma conta —
clique em botão (até 3 contas) ou toque em item da lista (4 ou mais). Os dois
chegam com o mesmo `message.type` (`boleto-N`), resolvido em `services/message.js`.

| Condição | Resultado |
|---|---|
| Texto com palavra-chave de saída | Volta ao menu — estado e boletos limpos |
| Botão de menu (`assusa-segunda-via` etc.) | Estado e boletos limpos → dispatch normal |
| `boleto-N` válido com boletos no cache | Solicita segunda via ao Sicoob |
| Número digitado dentro do intervalo (`"2"`) | Idem — mesma conta que o botão 2 |
| Texto solto ou número fora do intervalo | Pede de novo — **sessão mantida** |
| Sem cache no Redis (TTL expirou) | Erro de serviço — estado limpo |

> Após entregar um boleto o estado é **mantido** e o TTL renovado, para o cliente
> escolher outra conta sem redigitar o CPF (`refrescarSessaoBoletos`).

---

## Formatação e limites de apresentação

Os valores são formatados no padrão brasileiro antes de enviar ao usuário
(`services/boletoView.js`):

| Campo | Formato | Exemplo |
|---|---|---|
| Data completa (`dataVencimento`) | `DD/MM/YYYY` | `20/05/2026` |
| Data curta (título do botão) | `DD/MM` | `20/05` |
| Valor monetário | `R$ X.XXX,XX` | `R$ 1.234,56` |
| CPF ecoado ao cliente | `NNN.***.**N-NN` | `123.***.**9-00` |

A escolha entre botões e lista vem dos limites da Meta para mensagens interativas:

| Formato | Quando | Limite |
|---|---|---|
| Botões (`messageWithInteractiveReply`) | 1 a 3 contas | 3 botões, título ≤ 20 chars |
| Lista (`messageWithInteractiveList`) | 4 ou mais contas | 10 linhas, título ≤ 24, descrição ≤ 72 |

### Redes de segurança no envio

A Meta recusa a mensagem interativa **inteira** (HTTP 400) por detalhes de formato.
Três defesas evitam que o cliente fique sem resposta:

1. **Fallback em texto** — se o envio interativo falhar, a mesma lista sai como
   texto simples pedindo o número da conta (`enviarSelecaoBoletos`).
2. **Estado gravado só após o envio** — uma recusa nunca deixa o cliente preso em
   `aguardando_selecao_boleto` sem ter visto as opções.
3. **Aviso de falha inesperada** — o `.catch` do webhook em `app.js` chama
   `Conversation.avisarFalhaInesperada`, então um erro não previsto vira uma
   mensagem de desculpa em vez de silêncio.

O teto de 10 linhas é o que limita quantas contas o bot exibe
(`boletoView.MAX_BOLETOS_EXIBIDOS`); acima disso o cliente recebe o aviso com o
telefone. Os títulos são truncados defensivamente para nunca estourar o limite —
`test/boletoView.test.js` cobre esses cortes.

---

## Fluxo de segunda via — detalhe interno

```
handleSelecaoBoleto()
    │
    ├── busca boleto[idx] do Redis
    ├── chama sicoobClient.segundaViaBoleto({
    │     numeroCliente: SICOOB_NUMERO_CLIENTE,   ← vem do .env
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
            └── ✉ "Posso te ajudar com mais alguma coisa?" + menu (1 botão)
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
NENHUM_BOLETO          → sem contas em aberto e o histórico não pôde ser consultado
CLIENTE_EM_DIA         → sem contas em aberto, mas há histórico (cliente em dia)
CPF_NAO_ENCONTRADO     → nenhum registro para o CPF (não é cliente)
BOLETOS_LISTADOS       → boletos exibidos com sucesso { total, exibidos }
SELECAO_FALLBACK_TEXTO → a Meta recusou a mensagem interativa; lista enviada como texto
BOLETO_SELECIONADO     → usuário escolheu um boleto { idx, dataVencimento }
PDF_ENTREGUE           → PDF enviado com sucesso { dataVencimento, valor }
HORARIO_CONSULTADO     → usuário clicou em horário (botão legado)
MENU_EXIBIDO           → mensagem desconhecida → menu enviado
MENU_VIA_BOTAO         → cliente tocou em "Voltar ao menu" numa mensagem de fim de fluxo
LISTA_REEXIBIDA        → cliente tocou em "Ver outras contas"; lista servida do cache
SESSAO_EXPIRADA        → tocou em "Ver outras contas" mas o TTL já havia expirado
FLUXO_CANCELADO        → usuário digitou palavra-chave de saída (menu/sair/voltar/...)
```

---

## Menu principal

O menu exibe **1 botão** (dois slots livres):

| ID | Texto exibido |
|---|---|
| `assusa-segunda-via` | 2ª via de conta |

Toda mensagem de **fim de fluxo** (CPF inválido, CPF fora do cadastro, cliente em dia,
nenhuma conta encontrada, sistema fora do ar, falha inesperada e resposta não entendida)
sai acompanhada de um botão **"Voltar ao menu"** (`assusa-menu`), que reexibe esta tela.
Antes era preciso *digitar* "menu" — barreira real para o público idoso. O botão entra em
`MENU_BUTTONS`, então limpa estado e boletos antes do dispatch; se a Meta recusar o
interativo, o texto ainda é enviado (`enviarComBotaoMenu`).

O botão "Falar com atendente" foi removido do fluxo — junto com seu handler, suas
constantes e a notificação por e-mail (o antigo `services/mailer.js`). O telefone
(31) 3624-8550 continua nas mensagens de erro como canal humano.

O botão `assusa-horario-funcionamento` nunca foi exibido no menu, mas seu handler
permanece no código.

---

## Mensagens enviadas ao usuário

| Constante | Texto |
|---|---|
| `APP_DEFAULT_MESSAGE` | "Olá! Bem-vindo à Assusa Distribuidora de Água. Como podemos te ajudar hoje?\n\nA qualquer momento, digite *menu*, *sair* ou *voltar* para retornar ao início." |
| `APP_TRY_ANOTHER_MESSAGE` | "Posso te ajudar com mais alguma coisa?" |
| `MSG_HORARIO_FUNCIONAMENTO` | "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h." |
| `MSG_SOLICITAR_CPF_1` | "Digite o CPF cadastrado na ASSUSA (titular da conta)" |
| `MSG_SOLICITAR_CPF_2` | "Pode digitar do jeito que for mais fácil. Exemplos:\n- 12345678900\n- 123.456.789-00\n- 123 456 789 00" |
| `MSG_CPF_INVALIDO` | "Esse CPF parece incompleto ou incorreto.\n\nConfira os 11 números e envie de novo." |
| `MSG_CLIENTE_EM_DIA` | "Boa notícia: não há contas em aberto no CPF {CPF}.\n\nVocê está em dia com a Assusa. 😊" |
| `MSG_CPF_NAO_ENCONTRADO` | "Não localizei esse CPF no cadastro da Assusa.\n\nConfira se digitou o CPF do *titular* da conta de água. Se estiver certo, ligue para (31) 3624-8550." |
| `MSG_NENHUM_BOLETO` | "Não encontrei contas em aberto nesse CPF.\n\nIsso pode ser porque está tudo pago, ou porque o CPF não é o do titular da conta. Em caso de dúvida, ligue para (31) 3624-8550." |
| `MSG_SELECIONAR_BOLETO` | "Encontrei {TOTAL} conta(s) em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nToque no botão da conta que deseja pagar:" |
| `MSG_SELECIONAR_BOLETO_TEXTO` | "Encontrei {TOTAL} conta(s) em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nResponda com o *número* da conta que deseja pagar (1, 2, 3...)." |
| `MSG_SELECIONAR_BOLETO_LISTA` | "Encontrei {TOTAL} contas em aberto. O valor já está atualizado para pagamento hoje.\n\n{LISTA}\n\nToque em *Ver minhas contas* aqui embaixo e escolha a que deseja pagar:" |
| `MSG_SELECIONAR_BOLETO_ITEM` | "{N}) Conta de {DATA} — R$ {VALOR}" |
| `MSG_CONSULTANDO_BOLETOS` | "Aguarde, estou consultando seus boletos..." |
| `MSG_AVISO_MUITOS_BOLETOS` | "Você possui {TOTAL} contas em aberto. Estou mostrando as {EXIBIDOS} mais antigas — para as demais, ligue para (31) 3624-8550." |
| `MSG_LISTA_BOTAO` | "Ver minhas contas" |
| `MSG_LISTA_SECAO` | "Contas em aberto" |
| `MSG_LISTA_ITEM_DESCRICAO` | "Valor atualizado: R$ {VALOR}" |
| `MSG_BOLETO_CAPTION` | "✅ Sua 2ª via\n\nPague até {DATA}\nValor: R$ {VALOR}" |
| `MSG_LABEL_LINHA_DIGITAVEL` | "Linha digitável do boleto:" |
| `MSG_LABEL_PIX` | "PIX copia e cola:" |
| `MSG_PIX_INDISPONIVEL` | "PIX não disponível para este boleto." |
| `MSG_POS_ENTREGA_OUTRAS` | "Pronto! Sua conta de {DATA} foi enviada. ✅\n\nVocê ainda tem {RESTANTES} conta(s) em aberto. O que deseja agora?" |
| `MSG_POS_ENTREGA_UNICA` | "Pronto! Sua conta de {DATA} foi enviada. ✅\n\nPosso ajudar com mais alguma coisa?" |
| `MSG_SESSAO_EXPIRADA` | "Já faz um tempo desde a sua consulta e não tenho mais sua lista de contas.\n\nToque no botão abaixo para consultar de novo." |
| `MSG_SELECAO_NAO_ENTENDIDA` | "Não entendi sua resposta.\n\nResponda com o *número* da conta que deseja pagar, de 1 a {TOTAL}." |
| `MSG_ERRO_INESPERADO` | "Tive um problema aqui e não consegui concluir seu atendimento.\n\nToque no botão abaixo para recomeçar, ou ligue para (31) 3624-8550." |
| `MSG_SEGUNDA_VIA_ERRO_SERVICO` | "Nosso sistema está fora do ar neste momento.\n\nTente de novo em alguns minutos ou ligue para (31) 3624-8550." |

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
  │ erro / 0 boletos  │ 1+ boletos                    │          │
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
