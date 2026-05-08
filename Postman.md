# Guia de Testes — Postman

## 1. Pré-requisitos

- Stack rodando: `docker compose up --build`
- Node.js (bot) em `http://localhost:8080`
- Microsserviço Python (Sicoob) em `http://localhost:8090`

### Modo sandbox (sem certificados)

Para testar sem as chaves e certificados reais do Sicoob, garanta que o `.env` tenha:

```
SICOOB_SANDBOX=true
```

Com isso o microsserviço usa token e client_id hardcoded do ambiente de testes do Sicoob e não exige nenhum arquivo de certificado. O valor padrão já é `true`, então se a variável não estiver no `.env` o sandbox já está ativo.

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
| `SICOOB_NUMERO_CLIENTE` | mesmo valor do `.env` | Número de cliente da Assusa no Sicoob (cedente) |

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

**Resultado esperado (sandbox ativo):** bot responde com botões de seleção de boleto, usando dados fictícios do ambiente de testes do Sicoob.

**Resultado esperado (Python fora do ar):** bot responde com mensagem de serviço indisponível.

> Em sandbox, use apenas CPFs cadastrados nos dados de teste do Sicoob. Se não tiver essa lista, solicite ao Sicoob ou à cooperativa da Assusa.

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
  "numeroCliente": "{{SICOOB_NUMERO_CLIENTE}}",
  "dataInicio": "2024-01-01",
  "dataFim": "2026-05-07"
}
```

> `numeroCliente` é o número de cliente da **Assusa** no Sicoob (o cedente), não o CPF do usuário. O bot preenche esse campo automaticamente via `SICOOB_NUMERO_CLIENTE` do `.env`.

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
  "numeroCliente": "{{SICOOB_NUMERO_CLIENTE}}",
  "codigoModalidade": 1,
  "linhaDigitavel": "012345678901234567890123456789012345678901234567"
}
```

> Use a `linhaDigitavel` retornada pelo `/listar` acima — não invente o valor.

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

### 5.4 POST /interno/interacao — registrar evento manualmente

Grava uma interação diretamente no PostgreSQL, sem passar pelo bot.

**Headers:**
```
Content-Type: application/json
X-Internal-Api-Key: {{INTERNAL_API_KEY}}
```

**Body:**
```json
{
  "telefone": "{{USER_PHONE}}",
  "evento": "TESTE",
  "cpf": null,
  "detalhes": null
}
```

**Resposta esperada:**
```json
{ "ok": true }
```

> Os campos `cpf` e `detalhes` são opcionais. `detalhes` aceita qualquer objeto JSON.

---

### 5.5 GET /interno/interacoes — consultar interações

Retorna interações gravadas com filtros opcionais.

**Headers:**
```
X-Internal-Api-Key: {{INTERNAL_API_KEY}}
```

**Query params (todos opcionais):**

| Parâmetro | Exemplo | Descrição |
|---|---|---|
| `telefone` | `5531999999999` | Filtra por número |
| `cpf` | `12345678901` | Filtra por CPF |
| `evento` | `PDF_ENTREGUE` | Filtra por tipo de evento |
| `data_inicio` | `2026-01-01` | A partir desta data |
| `data_fim` | `2026-12-31` | Até esta data |
| `limite` | `50` | Máx. de registros (padrão 50, máx. 200) |

**Exemplo:**
```
GET {{PYTHON_URL}}/interno/interacoes?telefone={{USER_PHONE}}&limite=20
```

**Resposta esperada:**
```json
{
  "ok": true,
  "result": [
    {
      "id": 1,
      "telefone": "5531999999999",
      "evento": "MENU_EXIBIDO",
      "cpf": null,
      "detalhes": null,
      "criado_em": "2026-05-08T00:10:00Z"
    }
  ]
}
```

> Resultados ordenados do mais recente para o mais antigo.

**Eventos possíveis:**

| Evento | Quando |
|---|---|
| `MENU_EXIBIDO` | Mensagem desconhecida → menu enviado |
| `SEGUNDA_VIA_INICIADA` | Usuário clicou em 2ª via |
| `ATENDENTE_SOLICITADO` | Usuário clicou em falar com atendente |
| `HORARIO_CONSULTADO` | Usuário clicou em horário |
| `CPF_INVALIDO` | CPF com dígitos != 11 |
| `NENHUM_BOLETO` | Sicoob retornou lista vazia |
| `BOLETOS_LISTADOS` | Boletos exibidos como botões |
| `BOLETO_SELECIONADO` | Usuário clicou em um boleto |
| `PDF_ENTREGUE` | PDF enviado com sucesso |
| `ERRO_SERVICO` | Falha na chamada ao Python/Sicoob |

---

## 6. Fluxo completo passo a passo

Execute nesta ordem para simular um atendimento real:

```
1. GET  /webhook                        → handshake (1x só)
2. POST /webhook                        → msg 4.3 (texto qualquer) → confirma menu principal
3. POST /webhook                        → msg 4.4 (botão 2ª via)   → confirma pedido de CPF
4. POST /webhook                        → msg 4.5 (CPF válido)     → confirma lista de boletos
5. POST /webhook                        → msg 4.6 (boleto-0)       → confirma envio do PDF
6. GET  /interno/interacoes?telefone=…  → confirma todos os eventos gravados em ordem
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
| Python falha ao subir com erro de certificado | `SICOOB_SANDBOX` não está `true` e nenhum certificado foi configurado |
| `"nenhum boleto encontrado"` mesmo com CPF válido | CPF não está cadastrado nos dados de teste do sandbox do Sicoob |
| Estado não persiste entre requests | Redis não está rodando ou `REDIS_HOST` aponta para endereço errado |
| `numeroCliente` rejeitado pelo Python | Valor não é numérico — confirme que `SICOOB_NUMERO_CLIENTE` está preenchido no `.env` |
| `GET /interno/interacoes` retorna `[]` | `DATABASE_URL` não configurado ou postgres não subiu — verifique `docker ps` |
| `POST /interno/interacao` retorna 500 | Campo `telefone` ou `evento` ausente no body |
