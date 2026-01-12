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

No Google Cloud Console, configure as variáveis de ambiente:

**Obrigatórias:**
- `CPF_PEPPER`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `SICOOB_CLIENT_ID`
- `SICOOB_CLIENT_SECRET`
- `SICOOB_NUMERO_CLIENTE`
- `SICOOB_CODIGO_MODALIDADE`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

**Opcionais (com defaults):**
- `NODE_ENV=production`
- `PORT=8080` (Cloud Run usa 8080)
- `SICOOB_BASE_URL` (ou usar default)
- `SICOOB_AUTH_TOKEN_URL` (ou usar default)
- `REDIS_URL` (se usar Redis)
- `REDIS_ENABLED=true`

### 3. Build e Push da Imagem Docker

```bash
# Build da imagem
docker build -t gcr.io/SEU_PROJECT_ID/assusa:latest .

# Push para Google Container Registry
docker push gcr.io/SEU_PROJECT_ID/assusa:latest
```

### 4. Deploy no Cloud Run

```bash
gcloud run deploy assusa \
  --image gcr.io/SEU_PROJECT_ID/assusa:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars PORT=8080
```

Ou configure as variáveis via Console do Google Cloud.

### 5. Configurar Webhook do WhatsApp

Após o deploy, configure o webhook do WhatsApp para apontar para:

```
https://SEU_SERVICO.run.app/webhooks/whatsapp
```

**Token de verificação:** Use o valor de `WHATSAPP_VERIFY_TOKEN`

## 🔍 Validação Pós-Deploy

### 1. Health Check

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

### 2. Verificar Logs

```bash
gcloud run services logs read assusa --limit 50
```

Ou via Console do Google Cloud: **Cloud Run > assusa > Logs**

### 3. Testar Fluxo Completo

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
