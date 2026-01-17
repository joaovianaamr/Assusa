# 🔌 Integrações de APIs Externas

Este documento descreve como configurar e integrar com as APIs externas usadas pelo projeto Assusa.

## 📋 Índice

- [WhatsApp Cloud API](#whatsapp-cloud-api)
- [Sicoob API](#sicoob-api)
- [Bradesco API](#bradesco-api)
- [Google APIs](#google-apis)
- [Redis](#redis)

## WhatsApp Cloud API

### Sobre

O WhatsApp Cloud API é usado para enviar e receber mensagens do WhatsApp. O sistema recebe mensagens via webhook e responde usando a API.

### Configuração

#### 1. Criar Aplicação WhatsApp

1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Crie uma aplicação ou selecione uma existente
3. Adicione o produto **WhatsApp**
4. Configure o **WhatsApp Business Account**

#### 2. Obter Credenciais

No dashboard da aplicação WhatsApp, você encontrará:

- **API Token**: Token de acesso temporário (gerar permanente via API)
- **Phone Number ID**: ID do número de telefone configurado
- **Verify Token**: Token personalizado para verificação do webhook (você escolhe)

#### 3. Configurar Webhook

Após o deploy do sistema, configure o webhook no Meta for Developers:

1. Vá em **WhatsApp** > **Configuração** > **Webhooks**
2. Clique em **Configurar Webhooks**
3. Configure:
   - **URL de retorno de chamada**: `https://seu-servico.run.app/webhooks/whatsapp`
   - **Token de verificação**: Use o valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env`
   - **Campos de assinatura**: Marque pelo menos `messages`
4. Salve e teste a verificação

**Importante**: 
- A URL deve ser pública e HTTPS
- O token de verificação deve corresponder ao `WHATSAPP_VERIFY_TOKEN`

#### 4. Variáveis de Ambiente

```env
WHATSAPP_API_TOKEN=seu_token_permanente
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id
WHATSAPP_VERIFY_TOKEN=seu_token_seguro_aleatorio
WHATSAPP_WEBHOOK_URL=https://seu-servico.run.app/webhooks/whatsapp
```

### Endpoints Utilizados

- **Enviar mensagem**: `POST https://graph.facebook.com/v18.0/{phone-number-id}/messages`
- **Webhook**: `GET/POST /webhooks/whatsapp` (seu servidor)

### Documentação Oficial

- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

## Sicoob API

### Sobre

A API Cobrança Bancária v3 do Sicoob é usada para buscar e gerar segunda via de boletos. A autenticação usa OAuth2 Client Credentials, e pode requerer certificados SSL (mTLS).

### Configuração

#### 1. Obter Credenciais

1. Entre em contato com o Sicoob para obter:
   - `CLIENT_ID`: ID da aplicação
   - `CLIENT_SECRET`: Secret da aplicação
   - `NUMERO_CLIENTE`: Identificador do beneficiário/contrato
   - `CODIGO_MODALIDADE`: Código da modalidade de cobrança

2. Se necessário, obtenha certificados SSL para mTLS

#### 2. Configurar Certificados (mTLS)

Se a API exigir certificados SSL, use uma das opções:

**Opção 1: PFX em Base64 (Recomendado)**

```env
SICOOB_CERT_PFX_BASE64=base64_do_certificado
SICOOB_CERT_PFX_PASSWORD=senha_do_certificado
```

**Opção 2: PEM Separado**

```env
SICOOB_CERTIFICATE_PATH=/caminho/para/cert.pem
SICOOB_KEY_PATH=/caminho/para/key.pem
```

#### 3. Variáveis de Ambiente

```env
# Obrigatórias
SICOOB_CLIENT_ID=seu_client_id
SICOOB_CLIENT_SECRET=seu_client_secret
SICOOB_NUMERO_CLIENTE=seu_numero_cliente
SICOOB_CODIGO_MODALIDADE=seu_codigo_modalidade

# Opcionais (com defaults)
SICOOB_BASE_URL=https://api.sicoob.com.br/cobranca-bancaria/v3
SICOOB_AUTH_TOKEN_URL=https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token

# Sandbox (para testes)
# SICOOB_BASE_URL=https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3
```

### Fluxo de Requisições

1. **Autenticação**: OAuth2 Client Credentials
2. **Listar boletos por CPF**: `GET /pagadores/{cpf}/boletos`
3. **Consultar boleto**: `GET /boletos?numeroCliente={...}&codigoModalidade={...}&nossoNumero={...}`
4. **Gerar segunda via**: `GET /boletos/segunda-via?gerarPdf=true/false&nossoNumero={...}`

### Notas Importantes

- `SICOOB_NUMERO_CLIENTE` identifica o **beneficiário/contrato**, não cada CPF individual
- Todos os endpoints requerem o header `client_id`
- O token OAuth é cacheado automaticamente

### Documentação

📖 Veja [docs/SICOOB.md](SICOOB.md) para documentação detalhada e troubleshooting.

## Bradesco API

### Sobre

A API Open Banking do Bradesco é usada para buscar e gerar segunda via de boletos. A autenticação usa OAuth2 JWT Bearer (RS256).

### Configuração

#### 1. Obter Credenciais

1. Entre em contato com o Bradesco para:
   - Registrar sua aplicação
   - Obter `CLIENT_ID`
   - Obter certificado/chave privada RSA
   - Registrar o CNPJ do beneficiário

#### 2. Configurar Chave Privada

O Bradesco usa autenticação OAuth2 JWT Bearer (RS256). Você precisa de uma chave privada RSA:

**Opção 1: PEM (Recomendado)**

```env
BRADESCO_PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

**Opção 2: PFX em Base64**

```env
BRADESCO_PFX_BASE64=base64_do_certificado
BRADESCO_PFX_PASSWORD=senha_do_certificado
```

#### 3. Variáveis de Ambiente

```env
# Obrigatórias
BRADESCO_CLIENT_ID=seu_client_id
BRADESCO_PRIVATE_KEY_PEM=chave_privada_pem
BRADESCO_BENEFICIARY_CNPJ=12345678901234  # 14 dígitos

# Opcionais (com defaults)
BRADESCO_ENV=prod  # ou 'homolog'
BRADESCO_BASE_URL=https://openapi.bradesco.com.br
BRADESCO_API_PREFIX=/v1/boleto
```

### Autenticação

O sistema gera automaticamente um JWT assertion (RS256) usando:

- `BRADESCO_CLIENT_ID` como `iss` (issuer) e `sub` (subject)
- `BRADESCO_AUTH_URL` como `aud` (audience)
- Timestamp atual para `iat` e `exp`
- Assinatura RS256 usando `BRADESCO_PRIVATE_KEY_PEM`

O token é cacheado para otimizar requisições.

### Endpoints Utilizados

- **Autenticação**: `POST {BRADESCO_AUTH_URL}` (OAuth2 JWT Bearer)
- **Listar boletos**: `POST {BRADESCO_BASE_URL}{BRADESCO_API_PREFIX}/listar-titulo-pendente`
- **Consultar boleto**: `POST {BRADESCO_BASE_URL}{BRADESCO_API_PREFIX}/titulo-consultar`

### Headers Obrigatórios

Todas as requisições incluem:

- `Authorization: Bearer {token}`
- `cpf-cnpj: {BRADESCO_BENEFICIARY_CNPJ}`
- `X-Brad-Nonce`: Nonce único
- `X-Brad-Timestamp`: Timestamp em milissegundos
- `X-Brad-Algorithm`: `RS256`

### Detecção de Duplicidade

O sistema detecta automaticamente boletos duplicados entre bancos:

- Compara boletos pelo **mês de vencimento** (YYYY-MM) e **valor**
- Se encontrar boletos idênticos em bancos diferentes, registra evento `DUPLICATE_BANK_TITLE` no Google Sheets

## Google APIs

### Sobre

As APIs do Google (Drive e Sheets) são usadas para:
- **Google Drive**: Armazenar PDFs de boletos em pasta privada
- **Google Sheets**: Registrar todas as solicitações para auditoria

### Configuração

#### 1. Criar Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Vá em **APIs & Services** > **Library**
4. Habilite as seguintes APIs:
   - **Google Drive API**
   - **Google Sheets API**

#### 2. Criar Service Account

1. Vá em **IAM & Admin** > **Service Accounts**
2. Clique em **Create Service Account**
3. Preencha os dados:
   - **Name**: `assusa-service-account`
   - **Description**: `Service account para Assusa`
4. Clique em **Create and Continue**
5. (Opcional) Adicione roles se necessário
6. Clique em **Done**

#### 3. Gerar Chave JSON

1. Clique na service account criada
2. Vá em **Keys** > **Add Key** > **Create new key**
3. Selecione **JSON** e clique em **Create**
4. O arquivo JSON será baixado automaticamente

#### 4. Codificar JSON em Base64

O sistema espera o JSON completo codificado em base64:

```bash
# Linux/Mac
cat service-account.json | base64 -w 0

# Windows (PowerShell)
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("service-account.json"))
```

Copie o resultado e configure em `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.

#### 5. Configurar Google Drive

1. Acesse [Google Drive](https://drive.google.com/)
2. Crie uma nova pasta (ou use uma existente) para armazenar PDFs
3. Clique com o botão direito na pasta > **Compartilhar**
4. Adicione o email da service account (encontrado no campo `client_email` do JSON) com permissão de **Editor**
5. **Importante**: Não torne a pasta pública. Mantenha apenas a service account e membros autorizados
6. Para obter o **Folder ID**:
   - Abra a pasta no Google Drive
   - O ID está na URL: `https://drive.google.com/drive/folders/FOLDER_ID_AQUI`
   - Copie o `FOLDER_ID_AQUI`

#### 6. Configurar Google Sheets

1. Crie uma nova planilha no Google Sheets (ou use uma existente)
2. Compartilhe a planilha com o email da service account com permissão de **Editor**
3. Para obter o **Spreadsheet ID**:
   - Abra a planilha
   - O ID está na URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_AQUI/edit`
   - Copie o `SPREADSHEET_ID_AQUI`
4. (Opcional) Configure o nome da aba em `GOOGLE_SHEETS_WORKSHEET_NAME` (padrão: `Requests`)

#### 7. Variáveis de Ambiente

```env
# Obrigatórias
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=json_completo_codificado_em_base64
GOOGLE_DRIVE_FOLDER_ID=id_da_pasta_no_drive
GOOGLE_SHEETS_SPREADSHEET_ID=id_da_planilha

# Opcional
GOOGLE_SHEETS_WORKSHEET_NAME=Requests
```

### Estrutura da Planilha

A planilha deve ter uma aba chamada `Requests` (ou o nome configurado em `GOOGLE_SHEETS_WORKSHEET_NAME`) com as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| Timestamp | Data e hora da solicitação |
| Request ID | ID único da requisição |
| CPF Hash | Hash do CPF (LGPD compliant) |
| Tipo | Tipo de solicitação (PDF, código de barras, linha digitável) |
| Nosso Número | Número do boleto |
| Banco | Banco (SICOOB ou BRADESCO) |
| Status | Status da solicitação |

**Nota**: O sistema cria a estrutura automaticamente na primeira execução se a planilha estiver vazia.

### Permissões Necessárias

A service account precisa de:

- **Google Drive**: Editor na pasta configurada
- **Google Sheets**: Editor na planilha configurada

### Segurança

- **Pasta privada**: PDFs são salvos em pasta privada, não pública
- **Acesso restrito**: Apenas a service account e membros autorizados têm acesso
- **Logs**: Todas as operações são registradas na planilha para auditoria

## Redis

### Sobre

O Redis é usado para cache e armazenamento de estado de conversas. O sistema tem fallback automático para memória quando Redis não está disponível.

### Configuração

#### 1. Instalar Redis

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Cloud**: Use serviços gerenciados como Redis Cloud, AWS ElastiCache, Google Cloud Memorystore.

#### 2. Variáveis de Ambiente

```env
# Opcionais (tem fallback em memória)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

#### 3. Fallback Automático

Se Redis não estiver disponível, o sistema:

- ✅ Usa armazenamento em memória automaticamente
- ⚠️ Exibe um aviso nos logs
- ⚠️ Dados serão perdidos ao reiniciar o servidor

**Recomendação**: Em produção, sempre use Redis para persistência.

### Uso no Sistema

O Redis é usado para:

1. **Estado de Conversas**: Armazena o estado atual de cada conversa do WhatsApp
2. **Rate Limiting**: Controla taxa de requisições por IP/CPF
3. **Cache**: Cacheia tokens de autenticação de APIs externas

### Estrutura de Chaves

```
assusa:conversation:{phoneNumber}  # Estado da conversa
assusa:ratelimit:{identifier}      # Rate limiting
assusa:token:{api}                 # Tokens de autenticação
```

### Monitoramento

Para verificar se Redis está funcionando:

```bash
# Teste de conexão
redis-cli ping  # Deve retornar "PONG"

# Verificar chaves do Assusa
redis-cli KEYS "assusa:*"
```

## Troubleshooting

Para problemas específicos de cada integração, consulte:

- **WhatsApp**: Verifique logs do webhook e configuração no Meta for Developers
- **Sicoob**: Veja [docs/SICOOB.md](SICOOB.md)
- **Bradesco**: Verifique certificado e chave privada
- **Google APIs**: Verifique permissões da service account e IDs
- **Redis**: Veja logs do servidor para avisos de fallback

## Referências

- [Configuração Completa](CONFIGURATION.md) - Todas as variáveis de ambiente
- [Desenvolvimento](DEVELOPMENT.md) - Troubleshooting e boas práticas
- [Deploy](DEPLOY.md) - Configuração em produção
