# Guia de Deploy - Assusa

Este documento descreve o processo de deploy do Assusa em produção.

## 📋 Pré-requisitos

- [ ] Todas as variáveis de ambiente configuradas
- [ ] Configuração validada (`npm run validate-config`)
- [ ] Testes passando (`npm test`)
- [ ] Build compilando sem erros (`npm run build`)
- [ ] Acesso ao ambiente de produção (Google Cloud Run, etc.)

## 🚀 Deploy no Google Cloud Run

### 1. Preparar Ambiente

```bash
# Validar configuração
npm run validate-config

# Executar testes
npm test

# Build
npm run build
```

### 2. Configurar Variáveis de Ambiente no Cloud Run

#### Opção A: Via Console do Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **Cloud Run** > Selecione o serviço `assusa`
3. Clique em **EDITAR E IMPLANTAR NOVA REVISÃO**
4. Vá na aba **Variáveis e segredos**
5. Adicione cada variável manualmente

#### Opção B: Via gcloud CLI (Recomendado)

```bash
# Atualizar variáveis individuais
gcloud run services update assusa \
  --update-env-vars NODE_ENV=production,PORT=8080 \
  --region us-central1

# Ou usar arquivo .env (não commitar!)
gcloud run services update assusa \
  --update-env-vars-file .env.production \
  --region us-central1
```

**Variáveis Obrigatórias:**
- `CPF_PEPPER` ⚠️ **USE SECRET MANAGER!**
- `WHATSAPP_API_TOKEN` ⚠️ **USE SECRET MANAGER!**
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN` ⚠️ **USE SECRET MANAGER!**
- `WHATSAPP_APP_SECRET` ⚠️ **USE SECRET MANAGER!**
- `SICOOB_CLIENT_ID` ⚠️ **USE SECRET MANAGER!**
- `SICOOB_CLIENT_SECRET` ⚠️ **USE SECRET MANAGER!**
- `SICOOB_NUMERO_CLIENTE`
- `SICOOB_CODIGO_MODALIDADE`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` ⚠️ **USE SECRET MANAGER!**
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

**Variáveis Opcionais (com defaults):**
- `NODE_ENV=production`
- `PORT=8080` (já configurado pelo Cloud Run automaticamente)
- `SICOOB_BASE_URL` (ou usar default)
- `SICOOB_AUTH_TOKEN_URL` (ou usar default)
- `REDIS_URL` (se usar Redis)
- `REDIS_ENABLED=true`

#### Opção C: Via Secret Manager (Recomendado para Produção)

O Secret Manager é a forma mais segura de gerenciar dados sensíveis.

##### Criar Secrets

```bash
# CPF_PEPPER
echo -n "seu-pepper-aqui-minimo-32-caracteres" | gcloud secrets create cpf-pepper --data-file=-

# WhatsApp
echo -n "seu-token-aqui" | gcloud secrets create whatsapp-api-token --data-file=-
echo -n "seu-verify-token-aqui" | gcloud secrets create whatsapp-verify-token --data-file=-
echo -n "seu-app-secret-aqui" | gcloud secrets create whatsapp-app-secret --data-file=-

# Sicoob
echo -n "seu-client-id-aqui" | gcloud secrets create sicoob-client-id --data-file=-
echo -n "seu-client-secret-aqui" | gcloud secrets create sicoob-client-secret --data-file=-

# Google
echo -n "seu-service-account-json-base64-aqui" | gcloud secrets create google-service-account-json --data-file=-
```

##### Dar Permissões ao Cloud Run

Primeiro, obtenha o número do projeto e a service account do Cloud Run:

```bash
# Obter project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# Dar permissão de acesso aos secrets
gcloud secrets add-iam-policy-binding cpf-pepper \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding whatsapp-api-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repetir para todos os outros secrets...
```

##### Configurar Secrets no Cloud Run

```bash
gcloud run services update assusa \
  --update-secrets CPF_PEPPER=cpf-pepper:latest,WHATSAPP_API_TOKEN=whatsapp-api-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_APP_SECRET=whatsapp-app-secret:latest,SICOOB_CLIENT_ID=sicoob-client-id:latest,SICOOB_CLIENT_SECRET=sicoob-client-secret:latest,GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=google-service-account-json:latest \
  --region us-central1
```

**Nota**: Combine secrets do Secret Manager com variáveis de ambiente normais:

```bash
gcloud run services update assusa \
  --update-secrets CPF_PEPPER=cpf-pepper:latest,WHATSAPP_API_TOKEN=whatsapp-api-token:latest \
  --update-env-vars WHATSAPP_PHONE_NUMBER_ID=seu-phone-number-id,WHATSAPP_WEBHOOK_URL=https://seu-servico.run.app/webhooks/whatsapp \
  --region us-central1
```

##### Atualizar um Secret

```bash
# Atualizar versão do secret
echo -n "novo-valor" | gcloud secrets versions add cpf-pepper --data-file=-

# Cloud Run usará automaticamente a versão "latest"
# Para usar versão específica, especifique no --update-secrets:
# CPF_PEPPER=cpf-pepper:1 (usa versão 1)
```

### 3. Preparar Artifact Registry (Opcional, mas Recomendado)

O Artifact Registry é o serviço moderno do GCP. Alternativamente, use Container Registry (GCR).

```bash
# Criar repositório no Artifact Registry
gcloud artifacts repositories create assusa-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Repositório de imagens Docker do Assusa"

# Configurar autenticação Docker
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 4. Build e Push da Imagem Docker

**Opção A: Usando Cloud Build (Recomendado)**

```bash
# Build e push em um único comando (usa Artifact Registry)
gcloud builds submit --tag us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest

# Ou, se usar Container Registry:
# gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/assusa:latest
```

**Opção B: Build Local e Push Manual**

```bash
# Build da imagem
docker build -t us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest .

# Push para Artifact Registry
docker push us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest

# Ou, se usar Container Registry:
# docker tag us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest gcr.io/SEU_PROJECT_ID/assusa:latest
# docker push gcr.io/SEU_PROJECT_ID/assusa:latest
```

### 5. Deploy no Cloud Run

```bash
gcloud run deploy assusa \
  --image us-central1-docker.pkg.dev/SEU_PROJECT_ID/assusa-repo/assusa:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80 \
  --set-env-vars NODE_ENV=production
```

**Parâmetros importantes:**
- `--allow-unauthenticated`: Permite acesso público (necessário para webhook do WhatsApp)
- `--port 8080`: Porta padrão do Cloud Run (aplicação lê PORT automaticamente via `process.env.PORT`)
- `--memory 512Mi`: Memória alocada (ajuste conforme necessário, mínimo 128Mi)
- `--cpu 1`: CPUs alocadas (ajuste conforme necessário)
- `--min-instances 0`: Escala para zero quando não há tráfego (reduz custos)
- `--max-instances 10`: Máximo de instâncias (ajuste conforme necessário)
- `--timeout 300`: Timeout de 5 minutos (útil para gerar PDFs grandes)
- `--concurrency 80`: Requisições simultâneas por instância

**Nota**: O Cloud Run define automaticamente `PORT=8080` como variável de ambiente. A aplicação já lê essa variável, então não é necessário definir manualmente.

### 5. Configurar Webhook do WhatsApp

Após o deploy, obtenha a URL do serviço:

```bash
# Obter URL do serviço
gcloud run services describe assusa \
  --region us-central1 \
  --format 'value(status.url)'
```

A URL será algo como: `https://assusa-xxxxx-uc.a.run.app`

#### Configurar no Meta for Developers

1. **Acesse o Meta for Developers:**
   - Vá em [developers.facebook.com](https://developers.facebook.com/)
   - Faça login com sua conta

2. **Navegue até sua App do WhatsApp:**
   - No menu, vá em **WhatsApp** > **API Setup** ou **Configuração**

3. **Configure o Webhook:**
   - Clique em **Configurar Webhooks** ou **Edit**
   - **URL de retorno de chamada (Callback URL):**
     ```
     https://SEU_SERVICO.run.app/webhooks/whatsapp
     ```
   - **Token de verificação:**
     - Use o valor de `WHATSAPP_VERIFY_TOKEN` (o mesmo configurado nas variáveis de ambiente)
     - Este token deve ser único e seguro (ex: `openssl rand -hex 32`)
   - **Campos de assinatura (Webhook fields):**
     - Marque pelo menos: `messages`
     - Opcionalmente: `message_status` (para receber status de entrega)

4. **Salvar e Verificar:**
   - Clique em **Verificar e salvar**
   - O WhatsApp fará uma requisição GET para verificar o webhook
   - Se configurado corretamente, verá uma mensagem de sucesso

5. **Testar Recebimento de Mensagens:**
   - Envie uma mensagem de teste para o número do WhatsApp Business
   - Verifique os logs do Cloud Run:
     ```bash
     gcloud run services logs read assusa --region us-central1 --limit 20
     ```
   - Você deve ver logs de webhook recebido

#### Troubleshooting do Webhook

**Problema: Verificação falha**
- Verifique se `WHATSAPP_VERIFY_TOKEN` no Cloud Run é igual ao configurado no Meta
- Verifique se o endpoint GET `/webhooks/whatsapp` está acessível publicamente
- Verifique logs do Cloud Run para ver a requisição de verificação

**Problema: Mensagens não chegam**
- Verifique se os campos de assinatura estão marcados (`messages`)
- Verifique se a URL do webhook está correta e acessível via HTTPS
- Verifique logs do Cloud Run
- Verifique se o serviço está rodando (`gcloud run services describe assusa`)

**Problema: Erro 403 Forbidden**
- Verifique se a assinatura do webhook está sendo validada corretamente
- Verifique se `WHATSAPP_APP_SECRET` está configurado corretamente
- Verifique se o header `x-hub-signature-256` está sendo enviado pelo WhatsApp

## 🔍 Validação Pós-Deploy

### 6. Health Check

```bash
curl https://SEU_SERVICO.run.app/health
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T18:00:00.000Z"
}
```

### 7. Verificar Logs

```bash
gcloud run services logs read assusa --limit 50
```

Ou via Console do Google Cloud: **Cloud Run > assusa > Logs**

### 8. Testar Fluxo Completo

Siga o guia em `docs/VALIDACAO_MANUAL.md` para testar o fluxo completo.

## 📊 Monitoramento

### Logs

- **Google Cloud Console:** Cloud Run > assusa > Logs
- **Filtros úteis:**
  - `level:error` - Apenas erros
  - `requestId:abc-123` - Rastrear requisição específica
  - `cpfMasked` - Buscar por CPF (mascarado)

### Métricas

- **Requisições por minuto**
- **Taxa de erro**
- **Latência**
- **Uso de memória/CPU**

### Alertas Recomendados

1. **Taxa de erro > 5%**
2. **Latência p95 > 5s**
3. **Falhas de autenticação Sicoob**
4. **Falhas de webhook WhatsApp**

## 🔒 Segurança

### Checklist de Segurança

- [ ] `CPF_PEPPER` é único e seguro (32+ caracteres)
- [ ] `ALLOW_RAW_CPF_IN_FILENAME=false` em produção
- [ ] Certificados SSL (mTLS) configurados para Sicoob (se necessário)
- [ ] Redis com autenticação (se usado)
- [ ] Service Account do Google com permissões mínimas necessárias
- [ ] Webhook do WhatsApp com validação de assinatura habilitada
- [ ] Rate limiting configurado adequadamente

### Rotação de Credenciais

- **CPF_PEPPER:** Rotacionar periodicamente (requer migração de dados)
- **Tokens WhatsApp:** Rotacionar quando necessário
- **Credenciais Sicoob:** Seguir política do Sicoob
- **Service Account Google:** Rotacionar chaves periodicamente

## 🐛 Troubleshooting

### Problema: Serviço não inicia

**Verificar:**
1. Logs do Cloud Run
2. Variáveis de ambiente obrigatórias
3. Build da imagem Docker

**Solução:**
```bash
# Validar configuração localmente
npm run validate-config

# Verificar logs
gcloud run services logs read assusa --limit 100
```

### Problema: Erro 401/403 na API do Sicoob

**Verificar:**
1. `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET` corretos
2. `SICOOB_NUMERO_CLIENTE` e `SICOOB_CODIGO_MODALIDADE` corretos
3. Certificados SSL (se necessário)

**Solução:**
- Verificar credenciais no console do Sicoob
- Testar autenticação isoladamente
- Verificar logs para detalhes do erro

### Problema: Webhook do WhatsApp não funciona

**Verificar:**
1. URL do webhook está correta
2. `WHATSAPP_VERIFY_TOKEN` está correto
3. Serviço está acessível publicamente
4. Validação de assinatura (se habilitada)

**Solução:**
- Testar verificação do webhook manualmente
- Verificar logs do Cloud Run
- Verificar configuração no Meta for Developers

## 📝 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Configuração validada (`npm run validate-config`)
- [ ] Testes passando (`npm test`)
- [ ] Build compilando (`npm run build`)
- [ ] Imagem Docker buildada e enviada
- [ ] Serviço deployado no Cloud Run
- [ ] Health check retornando OK
- [ ] Webhook do WhatsApp configurado
- [ ] Logs sendo gerados corretamente
- [ ] Fluxo completo testado manualmente
- [ ] Monitoramento e alertas configurados

## 🔄 Rollback

Se necessário fazer rollback:

```bash
# Listar revisões
gcloud run revisions list --service assusa

# Fazer rollback para revisão anterior
gcloud run services update-traffic assusa \
  --to-revisions REVISION_NAME=100
```

## 📚 Referências

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Sicoob API Documentation](https://developers.sicoob.com.br/)
- `docs/SETUP.md` - Configuração inicial
- `docs/VALIDACAO_MANUAL.md` - Validação manual
