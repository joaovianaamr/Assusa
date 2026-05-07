# Guia de Testes — Postman

## 1. Pré-requisitos

- Stack rodando: `docker compose up --build`
- Node.js (bot) em `http://localhost:8080`
- Microsserviço Python (Sicoob) em `http://localhost:8090`

---

## 2. Environment do Postman

Crie um Environment chamado **assusa-local** com as variáveis abaixo:

| Variável | Valor de exemplo | Descrição |
|---|---|---|
| `BOT_URL` | `http://localhost:8080` | URL do bot Node.js |
| `PYTHON_URL` | `http://localhost:8090` | URL do microsserviço Python |
| `VERIFY_TOKEN` | mesmo valor do `.env` | Token de verificação do webhook |
| `APP_SECRET` | mesmo valor do `.env` | Segredo para assinar requisições |
| `INTERNAL_API_KEY` | `docker-dev-internal-key` | Chave interna Node → Python |
| `PHONE_NUMBER_ID` | `123456789` | ID do número de telefone WhatsApp |
| `USER_PHONE` | `5531999999999` | Número do usuário simulado |

---

## 3. Assinatura HMAC-SHA256 (obrigatória no POST /webhook)

O bot valida o header `x-hub-signature-256` em toda requisição POST. Adicione o script abaixo como **Pre-request Script** na coleção (ou em cada request POST):

```javascript
const body = pm.request.body.raw;
const secret = pm.environment.get('APP_SECRET');
const hash = CryptoJS.HmacSHA256(body, secret);
pm.request.headers.add({
    key: 'x-hub-signature-256',
    value: 'sha256=' + hash.toString(CryptoJS.enc.Hex)
});
```

> O Postman já inclui `CryptoJS` nativamente — não precisa instalar nada.

---

## 4. Coleção — Bot Node.js

### 4.1 GET /webhook — Verificação do handshake

Usado pela Meta para confirmar a URL do webhook. Só precisa rodar uma vez.

```
GET {{BOT_URL}}/webhook?hub.mode=subscribe&hub.verify_token={{VERIFY_TOKEN}}&hub.challenge=CHALLENGE_ACCEPTED
```

**Resposta esperada:** `200 CHALLENGE_ACCEPTED`

---

### 4.2 POST /webhook — Payload base

Todos os requests POST abaixo usam esta estrutura externa. Só o bloco `messages` muda.

**Headers:**
```
Content-Type: application/json
x-hub-signature-256: (gerado pelo pre-request script)
```

**Envelope comum:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WBA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "3132000000",
          "phone_number_id": "{{PHONE_NUMBER_ID}}"
        },
        "contacts": [{
          "profile": { "name": "Usuário Teste" },
          "wa_id": "{{USER_PHONE}}"
        }],
        "messages": [ <<SUBSTITUA AQUI>> ]
      },
      "field": "messages"
    }]
  }]
}
```

---

### 4.3 Mensagem desconhecida → exibe menu principal

Simula o usuário mandando um texto qualquer sem estado ativo.

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg001",
  "timestamp": "1699900000",
  "type": "text",
  "text": { "body": "oi" }
}]
```

**Resultado esperado:** bot responde com o menu de 3 botões (2ª via, Atendente, Horário).

---

### 4.4 Botão "2ª via de conta" → bot pede CPF

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg002",
  "timestamp": "1699900001",
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

**Resultado esperado:** bot responde pedindo o CPF + Redis grava `estado:<USER_PHONE> = aguardando_cpf`.

---

### 4.5 Envio do CPF → bot lista boletos

Deve ser enviado logo após o 4.4 (estado `aguardando_cpf` expira em 5 min).

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg003",
  "timestamp": "1699900002",
  "type": "text",
  "text": { "body": "12345678901" }
}]
```

**Resultado esperado (com Sicoob acessível):** bot responde com botões de seleção de boleto.

**Resultado esperado (sem Sicoob):** bot responde com mensagem de serviço indisponível.

**CPF inválido (menos de 11 dígitos):**
```json
"text": { "body": "123" }
```
**Resultado esperado:** bot responde com `MSG_SEGUNDA_VIA_ERRO` e mantém o estado.

---

### 4.6 Seleção de boleto → bot envia PDF

Deve ser enviado após o 4.5, enquanto o estado `aguardando_selecao_boleto` estiver ativo.

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg004",
  "timestamp": "1699900003",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "boleto-0",
      "title": "Venc. 2024-01-10"
    }
  }
}]
```

> Troque `boleto-0` por `boleto-1` ou `boleto-2` para selecionar o segundo ou terceiro boleto.

**Resultado esperado:** bot faz upload do PDF na Meta e envia como documento com caption (vencimento, valor, linha digitável, PIX).

---

### 4.7 Botão "Falar com atendente"

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg005",
  "timestamp": "1699900004",
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

**Resultado esperado:** bot responde com horário de atendimento e telefone.

---

### 4.8 Botão "Horário atendimento"

```json
"messages": [{
  "from": "{{USER_PHONE}}",
  "id": "wamid.msg006",
  "timestamp": "1699900005",
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

**Resultado esperado:** bot responde com os horários de funcionamento.

---

## 5. Coleção — Microsserviço Python

Estes requests batem direto no Python, sem passar pelo bot.

### 5.1 GET /health

```
GET {{PYTHON_URL}}/health
```

**Resposta esperada:** `200 { "status": "ok" }`

---

### 5.2 POST /internal/boleto/listar

**Headers:**
```
Content-Type: application/json
X-Internal-Api-Key: {{INTERNAL_API_KEY}}
```

**Body:**
```json
{
  "numeroCpfCnpj": "12345678901",
  "numeroCliente": 25546454,
  "dataInicio": "2024-01-01",
  "dataFim": "2026-01-01"
}
```

**Resposta esperada (sandbox):**
```json
{
  "ok": true,
  "result": {
    "status": 200,
    "response": { ... }
  }
}
```

---

### 5.3 POST /internal/boleto/segunda-via

**Headers:**
```
Content-Type: application/json
X-Internal-Api-Key: {{INTERNAL_API_KEY}}
```

**Body:**
```json
{
  "numeroCliente": 25546454,
  "codigoModalidade": 1,
  "linhaDigitavel": "012345678901234567890123456789012345678901234567"
}
```

**Resposta esperada (sandbox):**
```json
{
  "ok": true,
  "result": {
    "status": 200,
    "data": {
      "resultado": {
        "pdfBoleto": "JVBERi0x...",
        "linhaDigitavel": "...",
        "qrCode": "...",
        "dataVencimento": "2024-09-20",
        "valor": 156.23
      }
    }
  }
}
```

---

## 6. Fluxo completo passo a passo

Execute nesta ordem para simular um atendimento real:

```
1. GET  /webhook          → handshake (1x só)
2. POST /webhook          → msg 4.3 (texto qualquer) → confirma menu principal
3. POST /webhook          → msg 4.4 (botão 2ª via)   → confirma pedido de CPF
4. POST /webhook          → msg 4.5 (CPF válido)     → confirma lista de boletos
5. POST /webhook          → msg 4.6 (boleto-0)       → confirma envio do PDF
```

---

## 7. Inspecionar o Redis entre os steps

Para confirmar que o estado está sendo gravado corretamente:

```bash
docker exec -it <container_redis> redis-cli

# Ver estado do usuário
GET estado:5531999999999

# Ver boletos em cache
GET boletos:5531999999999

# Listar todas as chaves ativas
KEYS *
```

> O nome do container Redis pode ser consultado com `docker ps`.

---

## 8. Erros comuns

| Sintoma | Causa provável |
|---|---|
| `403 Forbidden` no POST /webhook | Header `x-hub-signature-256` ausente ou `APP_SECRET` errado no Environment |
| Bot não responde nada | `ACCESS_TOKEN` inválido — a chamada à Meta falha silenciosamente |
| `503` no Python | `INTERNAL_API_KEY` do Postman diferente do configurado no container |
| `"nenhum boleto encontrado"` mesmo com CPF válido | Sandbox do Sicoob ativo (`SICOOB_SANDBOX=true`) e CPF não cadastrado no sandbox |
| Estado não persiste entre requests | Redis não está rodando ou `REDIS_HOST` aponta para endereço errado |
