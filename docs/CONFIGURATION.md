# ⚙️ Configuração Completa

Este documento descreve todas as variáveis de ambiente e configurações disponíveis no projeto Assusa.

## 📋 Índice

- [Variáveis de Ambiente](#variáveis-de-ambiente)
  - [Servidor](#servidor)
  - [WhatsApp Cloud API](#whatsapp-cloud-api)
  - [Sicoob API](#sicoob-api)
  - [Bradesco API](#bradesco-api)
  - [Google APIs](#google-apis)
  - [Redis](#redis)
  - [Segurança & LGPD](#segurança--lgpd)
  - [Observabilidade](#observabilidade)
  - [Rate Limiting](#rate-limiting)
  - [Conversation State](#conversation-state)
  - [DevTools](#devtools)
- [Configuração de APIs Externas](#configuração-de-apis-externas)
- [Template de Configuração](#template-de-configuração)

## Variáveis de Ambiente

### Servidor

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `NODE_ENV` | Não | `development` | Ambiente de execução (`development`, `production`, `test`) |
| `PORT` | Não | `3000` | Porta do servidor HTTP |
| `HOST` | Não | `0.0.0.0` | Host do servidor HTTP |

### WhatsApp Cloud API

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `WHATSAPP_API_TOKEN` | ✅ Sim | Token de acesso da API do WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ Sim | ID do número de telefone no WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | ✅ Sim | Token de verificação do webhook (pode ser qualquer string segura) |
| `WHATSAPP_WEBHOOK_URL` | Não | URL pública do webhook (opcional, usado para validação) |

**Como obter:**
1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Crie uma aplicação WhatsApp
3. Obtenha o token e phone number ID no dashboard

📖 Veja [docs/API_INTEGRATIONS.md#whatsapp](API_INTEGRATIONS.md#whatsapp) para configuração detalhada.

### Sicoob API

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `SICOOB_CLIENT_ID` | ✅ Sim | - | Client ID da aplicação Sicoob |
| `SICOOB_CLIENT_SECRET` | ✅ Sim | - | Client Secret da aplicação Sicoob |
| `SICOOB_NUMERO_CLIENTE` | ✅ Sim | - | Identificador do beneficiário/contrato no Sicoob |
| `SICOOB_CODIGO_MODALIDADE` | ✅ Sim | - | Código da modalidade de cobrança |
| `SICOOB_BASE_URL` | Não | `https://api.sicoob.com.br/cobranca-bancaria/v3` | URL base da API |
| `SICOOB_AUTH_TOKEN_URL` | Não | `https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token` | URL de autenticação OAuth |
| `SICOOB_NUMERO_CONTRATO_COBRANCA` | Não | - | Número do contrato de cobrança |
| `SICOOB_CERT_PFX_BASE64` | Não | - | Certificado PFX codificado em base64 (para mTLS) |
| `SICOOB_CERT_PFX_PASSWORD` | Não | - | Senha do certificado PFX |
| `SICOOB_CERTIFICATE_PATH` | Não | - | Caminho do certificado SSL PEM (para mTLS) |
| `SICOOB_KEY_PATH` | Não | - | Caminho da chave privada SSL PEM (para mTLS) |

**Notas:**
- Para sandbox, use `SICOOB_BASE_URL=https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3`
- `SICOOB_NUMERO_CLIENTE` identifica o beneficiário/contrato, não cada CPF individual

📖 Veja [docs/API_INTEGRATIONS.md#sicoob](API_INTEGRATIONS.md#sicoob) e [docs/SICOOB.md](SICOOB.md) para detalhes.

### Bradesco API

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `BRADESCO_CLIENT_ID` | ✅ Sim | - | Client ID da aplicação Bradesco |
| `BRADESCO_PRIVATE_KEY_PEM` | ✅ Sim | - | Chave privada RSA em formato PEM para assinatura JWT (RS256) |
| `BRADESCO_BENEFICIARY_CNPJ` | ✅ Sim | - | CNPJ do beneficiário (14 dígitos, sem formatação) |
| `BRADESCO_ENV` | Não | `prod` | Ambiente (`prod` ou `homolog`) |
| `BRADESCO_BASE_URL` | Não | `https://openapi.bradesco.com.br` | URL base da API |
| `BRADESCO_AUTH_URL` | Não | Calculado automaticamente | URL de autenticação OAuth |
| `BRADESCO_API_PREFIX` | Não | `/v1/boleto` | Prefixo da API |
| `BRADESCO_PFX_BASE64` | Não | - | Certificado PFX codificado em base64 (alternativa ao PEM) |
| `BRADESCO_PFX_PASSWORD` | Não | - | Senha do certificado PFX |
| `BRADESCO_EXTRA_HEADERS` | Não | - | Headers extras opcionais (JSON string) |

**Notas:**
- URLs de autenticação são calculadas automaticamente baseadas em `BRADESCO_ENV`
- Produção: `https://openapi.bradesco.com.br/auth/server/v1.1/token`
- Homologação: `https://proxy.api.prebanco.com.br/auth/server/v1.2/token`

📖 Veja [docs/API_INTEGRATIONS.md#bradesco](API_INTEGRATIONS.md#bradesco) para detalhes.

### Google APIs

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | ✅ Sim | - | Service Account JSON codificado em base64 |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ Sim | - | ID da pasta no Google Drive onde PDFs serão salvos |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ✅ Sim | - | ID da planilha do Google Sheets |
| `GOOGLE_SHEETS_WORKSHEET_NAME` | Não | `Requests` | Nome da aba na planilha |

**Campos legados** (opcionais, mantidos para compatibilidade):
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PROJECT_ID`

📖 Veja [docs/API_INTEGRATIONS.md#google-apis](API_INTEGRATIONS.md#google-apis) para configuração detalhada.

### Redis

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `REDIS_URL` | Não | - | URL de conexão do Redis (ex: `redis://localhost:6379`) |
| `REDIS_ENABLED` | Não | `true` | Habilitar Redis (`true`/`false`) |

**Nota**: Se Redis não estiver disponível, o sistema usa fallback em memória automaticamente. Em produção, recomenda-se sempre usar Redis.

### Segurança & LGPD

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `CPF_PEPPER` | ✅ Sim | - | String secreta para hash do CPF (mínimo 32 caracteres) |
| `ALLOW_RAW_CPF_IN_FILENAME` | Não | `false` | Permitir CPF puro em nomes de arquivo (`true`/`false`) |
| `DATA_RETENTION_DAYS` | Não | `90` | Dias de retenção de dados |

**Importante**: 
- `CPF_PEPPER` é crítico para segurança. Nunca compartilhe ou commite.
- Gere uma string segura: `openssl rand -hex 32`

### Observabilidade

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `LOG_LEVEL` | Não | `info` | Nível de log (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `SERVICE_NAME` | Não | `assusa` | Nome do serviço para logs |

### Rate Limiting

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `RATE_LIMIT_MAX_REQUESTS` | Não | `100` | Máximo de requisições por janela |
| `RATE_LIMIT_WINDOW_MS` | Não | `60000` | Janela de tempo em milissegundos (padrão: 1 minuto) |

### Conversation State

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `CONVERSATION_STATE_TTL_SECONDS` | Não | `900` | TTL do estado da conversa em segundos (padrão: 15 minutos) |

### DevTools

| Variável | Obrigatório | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DEV_TOOLS_ENABLED` | Não | `false` | Habilitar DevTools Flow Tester (`true`/`false`) |
| `DEV_TOOLS_TOKEN` | Não | - | Token opcional para autenticação do DevTools |

**Nota**: DevTools só funciona em desenvolvimento (`NODE_ENV !== 'production'`).

## Configuração de APIs Externas

Para configurações detalhadas de cada API, consulte:

- **[WhatsApp](API_INTEGRATIONS.md#whatsapp)** - Configuração do webhook e integração
- **[Sicoob](API_INTEGRATIONS.md#sicoob)** - Configuração de OAuth e mTLS
- **[Bradesco](API_INTEGRATIONS.md#bradesco)** - Configuração de OAuth JWT
- **[Google APIs](API_INTEGRATIONS.md#google-apis)** - Service Account e configuração

## Template de Configuração

Um template completo está disponível em `docs/ENV_TEMPLATE.md`. Você pode usá-lo como base para criar seu arquivo `.env`.

### Exemplo Mínimo

```env
# Segurança (OBRIGATÓRIO)
CPF_PEPPER=SUA_STRING_SECRETA_MINIMO_32_CARACTERES

# WhatsApp (OBRIGATÓRIO)
WHATSAPP_API_TOKEN=seu_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_VERIFY_TOKEN=seu_verify_token

# Google (OBRIGATÓRIO)
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=seu_json_base64
GOOGLE_DRIVE_FOLDER_ID=seu_folder_id
GOOGLE_SHEETS_SPREADSHEET_ID=seu_spreadsheet_id

# Servidor (Opcional)
NODE_ENV=development
PORT=3000

# Redis (Opcional - tem fallback)
REDIS_ENABLED=false
```

## Validação de Configuração

Use o comando de validação para verificar se todas as variáveis obrigatórias estão configuradas:

```bash
npm run validate-config
```

Este comando verifica:
- ✅ Todas as variáveis obrigatórias estão presentes
- ✅ Valores são válidos (formato, tamanho, etc.)
- ⚠️ Avisos sobre configurações opcionais recomendadas

## Próximos Passos

Após configurar as variáveis de ambiente:

1. Valide a configuração: `npm run validate-config`
2. Execute em modo desenvolvimento: `npm run dev`
3. Configure as integrações: Veja [docs/API_INTEGRATIONS.md](API_INTEGRATIONS.md)
4. Teste o fluxo: Veja [docs/DEVELOPMENT.md#devtools-flow-tester](DEVELOPMENT.md#devtools-flow-tester)
