# Testes Postman — Webhook WhatsApp (Assusa)

Guia completo para simular mensagens do WhatsApp e testar os microsserviços
enviando requisições via Postman, sem precisar de um celular conectado.

---

## Ambiente Postman

Crie um **Environment** chamado `assusa-vps` com as variáveis abaixo:

| Variável | Valor | Descrição |
|---|---|---|
| `BASE_URL` | `https://assusa.tech` | Domínio da VPS (nginx + SSL, proxy → porta 8080) |
| `PYTHON_URL` | `http://187.127.39.44:8090` | Microsserviço Sicoob (porta exposta diretamente na VPS) |
| `PHONE_NUMBER_ID` | `1170317646154505` | Meta Business → WhatsApp → Números de telefone |
| `SENDER_PHONE` | `5531999999999` | Número do "usuário" simulado (E.164 sem `+`). Use sempre o mesmo dentro de um fluxo |
| `INTERNAL_API_KEY` | `<chave-definida-no-env-da-vps>` | Chave interna Node → Python — **nunca commite o valor real** |
| `SICOOB_NUMERO_CLIENTE` | `1964895` | Número de cliente da Assusa no Sicoob (cedente) |

> **Assinatura HMAC:** o app valida `x-hub-signature-256` apenas se o header
> estiver presente. Para testes, **omita o header** e a requisição passa
> sem validação. Veja a seção [Assinatura HMAC](#assinatura-hmac) para gerar
> o hash quando necessário.

---

## Estrutura base do payload (POST /webhook)

Todos os POSTs para `/webhook` seguem este envelope — só o bloco `messages` muda:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "ACCOUNT_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "3131111111",
          "phone_number_id": "{{PHONE_NUMBER_ID}}"
        },
        "contacts": [{
          "profile": { "name": "Usuário Teste" },
          "wa_id": "{{SENDER_PHONE}}"
        }],
        "messages": [ /* SUBSTITUIR */ ]
      }
    }]
  }]
}
```

**Headers obrigatórios em todos os POSTs:**
```
Content-Type: application/json
```

**Resposta HTTP de todos os POSTs:** `200 OK` com body `EVENT_RECEIVED`.
O processamento é assíncrono — a resposta do bot chega no WhatsApp, não no Postman.

---

## 1. Verificação do webhook

### 1.1 Token correto → 200

`GET {{BASE_URL}}/webhook`

| Query param | Valor |
|---|---|
| `hub.mode` | `subscribe` |
| `hub.verify_token` | `JoaoVitorVianaCientistaDeDados` |
| `hub.challenge` | `qualquer_string` |

**Resposta:** `200 OK` — body igual ao valor de `hub.challenge`.

---

### 1.2 Token errado → 403

`GET {{BASE_URL}}/webhook`

| Query param | Valor |
|---|---|
| `hub.mode` | `subscribe` |
| `hub.verify_token` | `token_errado` |
| `hub.challenge` | `qualquer_string` |

**Resposta:** `403 Forbidden`.

---

### 1.3 Status de entrega (delivered)

`POST {{BASE_URL}}/webhook`

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "ACCOUNT_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "3131111111",
          "phone_number_id": "{{PHONE_NUMBER_ID}}"
        },
        "statuses": [{
          "id": "wamid.test.001",
          "status": "delivered",
          "timestamp": "1748000000",
          "recipient_id": "{{SENDER_PHONE}}"
        }]
      }
    }]
  }]
}
```

> Usa o campo `statuses` em vez de `messages` — testa o caminho `handleStatus` no `app.js`.
> O id `wamid.test.001` não está no cache Redis → `handleStatus` ignora silenciosamente.

**Resposta HTTP:** `200 EVENT_RECEIVED` (sem mensagem no WhatsApp).

---

## 2. Menu principal

Qualquer mensagem de texto sem estado ativo no Redis exibe o menu.

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.001",
  "timestamp": "1748000000",
  "type": "text",
  "text": { "body": "Oi" }
}]
```

**Resposta no WhatsApp:** boas-vindas com **2 botões**:
- `2ª via de conta`
- `Falar com atendente`

O texto da mensagem inclui instrução de saída em negrito:
> "A qualquer momento, digite **menu**, **sair** ou **voltar** para retornar ao início."

> O botão "Horário atendimento" foi removido do menu. O handler ainda existe no
> código para compatibilidade com mensagens em trânsito — ver seção 3.

---

## 3. Horário de atendimento (botão legado)

Este botão **não aparece mais no menu principal**, mas o handler ainda funciona.
Use para verificar compatibilidade com mensagens antigas.

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.002",
  "timestamp": "1748000001",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "assusa-horario-funcionamento",
      "title": "Horário atendimento"
    }
  }
}]
```

**Resposta no WhatsApp:**
> "Nosso atendimento funciona de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h."

---

## 4. Falar com atendente

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.003",
  "timestamp": "1748000002",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "assusa-falar-atendente",
      "title": "Falar com atendente"
    }
  }
}]
```

**Resposta no WhatsApp:**
> "Nossos atendentes estão disponíveis de segunda a sexta, das 8h às 18h. Para falar com um atendente agora, ligue: (31)3624-8550."

> **Notificação por e-mail:** ao clicar neste botão, o bot dispara um e-mail para
> `ATENDENTE_EMAIL_TO` (via SMTP) com o número do cliente, CPF (se já informado) e
> data/hora. O envio é *fire-and-forget*: se o SMTP não estiver configurado ou falhar,
> o cliente ainda recebe a resposta normalmente. Continua gravando `ATENDENTE_SOLICITADO`
> no Postgres.

---

## 5. Fluxo completo — Segunda via

Execute as etapas **em ordem**. O estado entre etapas fica no Redis indexado
pelo `SENDER_PHONE`. Use sempre o mesmo número ou limpe o Redis antes de
recomeçar (ver seção [Redis](#redis)).

---

### 5.1 Clicar em "2ª via de conta"

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.010",
  "timestamp": "1748000010",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "assusa-segunda-via",
      "title": "2ª via de conta"
    }
  }
}]
```

**Resposta no WhatsApp (duas mensagens, em sequência):**
> 1. "Digite o CPF do titular da conta:"
> 2. "Exemplo: 12345678900 | 123.456.789-10"

**Estado no Redis após:** `aguardando_cpf`

---

### 5.2 Enviar CPF válido (com boletos)

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.011",
  "timestamp": "1748000011",
  "type": "text",
  "text": { "body": "15421449149" }
}]
```

> Em **sandbox** (`SICOOB_SANDBOX=true`), qualquer CPF com 11 dígitos retorna
> o mesmo boleto fictício do Sicoob. Em **produção**, use um CPF real
> de associado com boleto na Assusa.

**Resposta no WhatsApp (sequência de mensagens):**

1. Mensagem de loading:
   > "Aguarde, estou consultando seus boletos..."

2. Se total > 3: aviso com total e instrução para ligar para os demais

3. Mensagem com botões (até 3, ordenados do mais antigo), com o corpo enumerando
   cada conta pelo **vencimento original** e o **valor já atualizado para hoje**:
   > "Encontrei X conta(s) em aberto. O valor já está atualizado para pagamento hoje.
   >
   > 1) Conta de 16/05/2026 — R$ 76,97
   > 2) Conta de 20/05/2026 — R$ 379,89
   > 3) Conta de 16/06/2026 — R$ 76,25
   >
   > Toque no botão da conta que deseja pagar:"

   Botões (título limitado a 20 caracteres):
   - `1 - Conta DD/MM`, `2 - Conta DD/MM`, ...

> **Por que o vencimento original?** A listagem (`/listar`) traz o vencimento e o valor
> **originais** de cada boleto; a 2ª via (`/segunda-via`) **recalcula** para pagamento hoje
> com juros/multa. O bot enriquece cada item chamando a 2ª via (sem PDF) no momento da
> listagem, então a lista mostra o **valor atualizado** e o PDF entregue mostra "pague até
> hoje" — sem o conflito de datas que existia antes (botão "16/05" vs PDF "17/06").

**Estado no Redis após:** `aguardando_selecao_boleto` + boletos em cache (TTL 30 min,
renovado a cada interação)

---

### 5.2b Enviar CPF com pontuação

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.011b",
  "timestamp": "1748000015",
  "type": "text",
  "text": { "body": "154.214.491-49" }
}]
```

> O código faz `replace(/\D/g, "")` antes de validar — `"154.214.491-49"` vira `"15421449149"`.

**Resposta no WhatsApp:** igual ao 5.2 (loading + botões com boletos).

---

### 5.3 Selecionar um boleto

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.012",
  "timestamp": "1748000012",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "boleto-0",
      "title": "Vence 20/05"
    }
  }
}]
```

> O `title` não é processado pelo bot — apenas o `id` importa.
> Use `boleto-0`, `boleto-1` ou `boleto-2` conforme o botão exibido.

| `id` | Boleto |
|---|---|
| `boleto-0` | 1º da lista (mais antigo) |
| `boleto-1` | 2º da lista |
| `boleto-2` | 3º da lista |

**Resposta no WhatsApp — agora em mensagens separadas** (facilita copiar no celular):
1. Documento `boleto.pdf` com caption:
   ```
   ✅ Sua 2ª via

   Pague até DD/MM/YYYY
   Valor: R$ X.XXX,XX
   ```
2. Texto: `Linha digitável do boleto:`
3. Texto: `<linha digitável>` (sozinha, fácil de copiar)
4. Texto: `PIX copia e cola:`
5. Texto: `<pix copia e cola>` (sozinho, fácil de copiar)

> A data e o valor da caption vêm da 2ª via (vencimento = hoje, valor atualizado).
> Se não houver PIX, no lugar dos passos 4-5 é enviado "PIX não disponível para este boleto."
> Se o upload do PDF falhar, a caption é enviada como texto e os blocos 2-5 seguem normalmente.

**Estado no Redis após:** **mantido** em `aguardando_selecao_boleto` com os boletos em cache
(TTL renovado). O cliente pode tocar em **outro** botão para receber outra conta **sem
redigitar o CPF**, até o TTL de 30 min expirar.

---

### 5.3b Selecionar segundo boleto

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.012b",
  "timestamp": "1748000013",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "boleto-1",
      "title": "⚠ Vencido 20/05"
    }
  }
}]
```

**Pré-requisito:** executar 5.1 → 5.2 (estado `aguardando_selecao_boleto`).

**Resposta no WhatsApp:** PDF do segundo boleto (índice `[1]` do cache Redis).

---

## 6. Casos de erro

### 6.1 CPF inválido

Execute a etapa 5.1 primeiro (estado `aguardando_cpf`), depois:

**Menos de 11 dígitos:**
```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.020",
  "timestamp": "1748000020",
  "type": "text",
  "text": { "body": "123" }
}]
```

**CPF com dígitos verificadores errados (11 dígitos, formato correto, mas inválido):**
```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.020b",
  "timestamp": "1748000020",
  "type": "text",
  "text": { "body": "12345678900" }
}]
```

**Resposta no WhatsApp (ambos os casos):**
> "Não encontrei uma conta ativa com esse CPF. Verifique os dados e tente
> novamente, ou fale com nosso atendente."

**Estado:** permanece `aguardando_cpf` (usuário pode tentar de novo).

---

### 6.2 CPF sem boletos

Execute a etapa 5.1 primeiro, depois envie um CPF válido sem boletos na Assusa:

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.021",
  "timestamp": "1748000021",
  "type": "text",
  "text": { "body": "00000000191" }
}]
```

**Resposta no WhatsApp:**
> "Não encontrei boletos em aberto para este CPF. Se achar que é um engano,
> fale com nosso atendente."

**Estado:** limpo.

---

### 6.3 Cancelar fluxo com palavra-chave

Execute a etapa 5.1 (estado `aguardando_cpf`), depois envie qualquer palavra-chave:

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.023",
  "timestamp": "1748000023",
  "type": "text",
  "text": { "body": "menu" }
}]
```

Palavras aceitas (case-insensitive, com ou sem acento): `menu` · `sair` · `voltar` · `cancelar` · `inicio` / `início`

**Resposta no WhatsApp:** menu principal com 2 botões.

**Estado no Redis:** limpo (`nil`).

Verificar:
```bash
docker exec assusa-redis-1 redis-cli GET estado:5531999999999
# deve retornar (nil)
```

**Interação gravada:** `FLUXO_CANCELADO`

> Funciona também no estado `aguardando_selecao_boleto`.

---

### 6.4 Seleção de boleto sem ter listado (estado inválido)

Enviar `boleto-0` sem ter passado pelo fluxo de listagem:

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.022",
  "timestamp": "1748000022",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": { "id": "boleto-0", "title": "Vence 20/05" }
  }
}]
```

**Resposta no WhatsApp:** menu principal (estado não é `aguardando_selecao_boleto`).

---

### 6.5 Escape via botão de menu (estado aguardando_cpf)

**Pré-requisito:** executar 5.1 (estado `aguardando_cpf`).

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.025",
  "timestamp": "1748000025",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "assusa-segunda-via",
      "title": "2ª via de conta"
    }
  }
}]
```

O bot detecta que é um botão de menu (`MENU_BUTTON`), limpa o estado e reinicia o fluxo.

**Resposta no WhatsApp:** `"Para enviar sua 2ª via, preciso do seu CPF..."`

**Estado no Redis:** `aguardando_cpf` (reiniciado).

---

### 6.6 Escape via botão de menu (estado aguardando_selecao_boleto)

**Pré-requisito:** executar 5.1 → 5.2 (estado `aguardando_selecao_boleto`).

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.026",
  "timestamp": "1748000026",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "assusa-falar-atendente",
      "title": "Falar com atendente"
    }
  }
}]
```

O bot detecta o botão de menu, limpa estado e boletos do Redis, e processa normalmente.

**Resposta no WhatsApp:** `"Nossos atendentes estão disponíveis..."`

**Estado no Redis:** `nil`. Boletos no Redis: `nil`.

---

### 6.7 Mensagem de áudio ou imagem (sem estado)

`POST {{BASE_URL}}/webhook`

```json
"messages": [{
  "from": "{{SENDER_PHONE}}",
  "id": "wamid.test.027",
  "timestamp": "1748000027",
  "type": "audio",
  "audio": { "id": "audio-fake-id" }
}]
```

Qualquer `type` diferente de `text` e `interactive` é tratado como desconhecido. Sem estado ativo → menu principal.

**Resposta no WhatsApp:** menu principal com 2 botões.

> **Atenção:** se o usuário estiver em `aguardando_cpf` e mandar áudio, o bot trata como CPF inválido (`text = undefined` → `cpfDigits = ""`).

---

### 6.8 Microsserviço Sicoob indisponível

```bash
docker stop assusa-sicoob-1
```

Execute as etapas 5.1 → 5.2.

**Resposta no WhatsApp:**
> "Aguarde, estou consultando seus boletos..."

Seguida de:
> "Nosso serviço está temporariamente indisponível. Tente novamente em alguns
> instantes ou ligue: (31) 3624-8550."

Restaurar: `docker start assusa-sicoob-1`

---

## 7. Microsserviço Sicoob (direto, sem bot)

Estes requests batem direto no Python via `http://localhost:8090`.

**Header obrigatório em todos:**
```
X-Internal-Api-Key: {{INTERNAL_API_KEY}}
Content-Type: application/json
```

---

### 7.1 Health check

`GET {{PYTHON_URL}}/health`

**Resposta:** `{ "status": "ok" }`

---

### 7.2 Listar boletos por CPF

`POST {{PYTHON_URL}}/internal/boleto/listar`

O pre-request script do Postman calcula as datas automaticamente (hoje − 30 dias → hoje):

```json
{
  "numeroCliente": 1964895,
  "numeroCpfCnpj": "{{CPF-TESTE-MAURI}}",
  "dataInicio": "{{DATA_INICIO}}",
  "dataFim": "{{DATA_FIM}}"
}
```

> **Limite da API Sicoob:** período máximo de **35 dias** por requisição.
> Períodos maiores retornam erro `5002 — "O período informado não pode ser maior que 35 dias"`.
>
> Este endpoint Python atende **1 janela por vez**. Quem orquestra a busca em múltiplas
> janelas é o Node (`services/sicoobClient.js`): ele dispara **6 chamadas paralelas de
> 30 dias cada** (configurável via `SICOOB_NUM_JANELAS`), cobrindo 6 meses de histórico.
> Use datas dentro de 35 dias ao chamar esta rota diretamente.

---

### 7.2b Listar boletos — período > 35 dias (erro 5002)

`POST {{PYTHON_URL}}/internal/boleto/listar`

```json
{
  "numeroCliente": 1964895,
  "numeroCpfCnpj": "{{CPF-TESTE-MAURI}}",
  "dataInicio": "2024-05-27",
  "dataFim": "2026-05-27"
}
```

Período de 2 anos → deve retornar erro `5002` do Sicoob: _"O período informado não pode ser maior que 35 dias"_.

Confirma que o limite está ativo em produção (o sandbox não aplica esse limite).

---

### 7.3 Consultar boleto por nosso número

`POST {{PYTHON_URL}}/internal/boleto/consultar`

```json
{
  "numeroCliente": 1964895,
  "codigoModalidade": 1,
  "nossoNumero": "3861"
}
```

Também aceita `linhaDigitavel` ou `codigoBarras` no lugar de `nossoNumero`
(pelo menos um obrigatório).

---

### 7.4 Segunda via por linha digitável

`POST {{PYTHON_URL}}/internal/boleto/segunda-via`

```json
{
  "numeroCliente": 1964895,
  "codigoModalidade": 1,
  "linhaDigitavel": "75691311750119648950200038610044714520000036907"
}
```

> Use a `linhaDigitavel` retornada pelo `/listar` ou `/consultar` —
> não invente o valor. A resposta inclui `pdfBoleto` em base64.

---

### 7.5 Faixas de nosso número disponíveis

`GET {{PYTHON_URL}}/internal/boleto/faixas-nosso-numero`

| Query param | Valor |
|---|---|
| `numeroCliente` | `1964895` |
| `codigoModalidade` | `1` |
| `quantidade` | `10` |

> **Produção:** retorna `404` — o contrato atual da Assusa não inclui este serviço.
> Verificar com o Sicoob se o serviço de faixas está habilitado para o `numeroCliente`.
> Em sandbox retorna `400` — limitação do ambiente de testes deles.

---

### 7.6 Consultar webhooks cadastrados

`GET {{PYTHON_URL}}/internal/webhook/consultar`

Retorna todos os webhooks de cobrança cadastrados na conta.

---

### 7.7 Registrar interação manualmente

`POST {{PYTHON_URL}}/interno/interacao`

```json
{
  "telefone": "{{SENDER_PHONE}}",
  "evento": "TESTE_MANUAL",
  "cpf": null,
  "detalhes": { "origem": "postman" }
}
```

**Resposta:** `{ "ok": true }`

---

### 7.8 Consultar interações

`GET {{PYTHON_URL}}/interno/interacoes`

Query params (todos opcionais):

| Param | Exemplo | Descrição |
|---|---|---|
| `telefone` | `5531999999999` | Filtrar por número |
| `cpf` | `15421449149` | Filtrar por CPF |
| `evento` | `PDF_ENTREGUE` | Filtrar por tipo |
| `data_inicio` | `2026-01-01` | A partir de |
| `data_fim` | `2026-12-31` | Até |
| `limite` | `50` | Máx. registros (padrão 50, máx. 200) |

**Eventos possíveis:**

| Evento | Quando ocorre |
|---|---|
| `MENU_EXIBIDO` | Mensagem desconhecida → menu enviado |
| `SEGUNDA_VIA_INICIADA` | Usuário clicou em 2ª via |
| `ATENDENTE_SOLICITADO` | Usuário clicou em falar com atendente |
| `HORARIO_CONSULTADO` | Usuário clicou em horário (botão legado) |
| `CPF_INVALIDO` | CPF com formato ou dígitos verificadores inválidos |
| `NENHUM_BOLETO` | Sicoob retornou lista vazia |
| `BOLETOS_LISTADOS` | Boletos exibidos como botões |
| `BOLETO_SELECIONADO` | Usuário clicou em um boleto |
| `PDF_ENTREGUE` | PDF enviado com sucesso |
| `ERRO_SERVICO` | Falha na chamada ao Python/Sicoob |
| `FLUXO_CANCELADO` | Usuário digitou palavra-chave de saída |

---

## Redis

```bash
# Ver estado atual do usuário simulado
docker exec assusa-redis-1 redis-cli GET estado:5531999999999

# Ver boletos em cache
docker exec assusa-redis-1 redis-cli GET boletos:5531999999999

# Limpar estado para recomeçar um fluxo
docker exec assusa-redis-1 redis-cli DEL estado:5531999999999 boletos:5531999999999

# Listar todas as chaves ativas
docker exec assusa-redis-1 redis-cli KEYS "*"
```

> TTL das chaves: **1800 segundos (30 minutos)** por padrão, configurável via
> `ESTADO_TTL_SECONDS`. É **deslizante**: cada interação (envio de CPF, seleção de
> boleto) renova o TTL. Após esse tempo sem interação o estado expira e o usuário
> volta ao início automaticamente.

---

## Logs em tempo real

```bash
docker logs -f assusa-web-1 & docker logs -f assusa-sicoob-1
```

Cada mensagem recebida imprime:
```
web-1    | WhatsApp webhook POST { object: 'whatsapp_business_account', entryCount: 1 }
sicoob-1 | INFO: 172.x.x.x - "POST /internal/boleto/listar HTTP/1.1" 200 OK
```

---

## Erros comuns

| Sintoma | Causa provável |
|---|---|
| `403` no POST `/webhook` | Header `x-hub-signature-256` presente mas hash errado |
| Bot não responde no WhatsApp | `ACCESS_TOKEN` expirado — gerar novo no Meta Business |
| `401` no Python | `INTERNAL_API_KEY` diverge entre `.env` e o header do Postman |
| `503` no Python | `SICOOB_SANDBOX=false` sem certificado configurado |
| Erro `5002 "período maior que 35 dias"` | Reduzir o intervalo entre `dataInicio` e `dataFim` |
| Erro `5002 "número do contrato"` | `numeroCliente` errado — usar `1964895`, não `1106591` |
| Sandbox retorna sempre o mesmo boleto | Comportamento esperado — o sandbox do Sicoob é mock estático |
| Estado não persiste entre requests | Redis fora do ar — verificar `docker compose ps` |
| `GET /interno/interacoes` retorna `[]` | `DATABASE_URL` errado ou PostgreSQL não subiu |
| Bot exibe menu em vez de processar CPF | TTL do Redis expirou (30 min sem interação) — reiniciar fluxo pela seção 5.1 |

---

## Assinatura HMAC

Para testar a validação de assinatura (simula o comportamento real da Meta):

**Pre-request Script no Postman:**
```javascript
const body = pm.request.body.raw;
const secret = pm.environment.get("APP_SECRET");
const hash = CryptoJS.HmacSHA256(body, secret);
pm.request.headers.upsert({
  key: "x-hub-signature-256",
  value: "sha256=" + hash.toString(CryptoJS.enc.Hex)
});
```

> O Postman inclui `CryptoJS` nativamente — não precisa instalar nada.
> `APP_SECRET` está no `.env`. Se o hash não bater, o app retorna `400`.
