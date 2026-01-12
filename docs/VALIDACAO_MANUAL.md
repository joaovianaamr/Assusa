# Guia de Validação Manual - Assusa

Este documento descreve como validar manualmente o fluxo completo do sistema após as mudanças implementadas.

## 📋 Pré-requisitos

1. Servidor rodando (`npm run dev` ou `npm start`)
2. Webhook do WhatsApp configurado e apontando para o servidor
3. Variáveis de ambiente configuradas (especialmente as novas do Sicoob v3)
4. Acesso ao WhatsApp Business para testar
5. Acesso ao Google Sheets para verificar registros

## ✅ Checklist de Validação

### 1. Validação de Configuração

#### Variáveis de Ambiente do Sicoob
- [ ] `SICOOB_CLIENT_ID` configurado
- [ ] `SICOOB_CLIENT_SECRET` configurado
- [ ] `SICOOB_NUMERO_CLIENTE` configurado
- [ ] `SICOOB_CODIGO_MODALIDADE` configurado
- [ ] `SICOOB_BASE_URL` configurado (ou usando default)
- [ ] `SICOOB_AUTH_TOKEN_URL` configurado (ou usando default)
- [ ] `SICOOB_NUMERO_CONTRATO_COBRANCA` configurado (se aplicável)

#### Outras Configurações
- [ ] WhatsApp configurado (`WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, etc.)
- [ ] Google Cloud configurado (`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, etc.)
- [ ] Redis configurado (ou usando fallback em memória)

### 2. Validação de Health Check

```bash
curl http://localhost:3000/health
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T18:00:00.000Z"
}
```

### 3. Validação do Fluxo WhatsApp - Menu Principal

1. Envie uma mensagem qualquer no WhatsApp
2. **Resultado esperado**: Sistema responde com menu:
   ```
   📋 *Menu Principal*
   
   [1] Gerar 2ª via de boleto
   [2] Fale com a gente
   [3] Acessar nosso site
   [4] EXCLUIR DADOS (LGPD)
   ```

### 4. Validação do Fluxo - Segunda Via (1 título)

1. Envie "1" ou "segunda via"
2. **Resultado esperado**: Sistema exibe aviso LGPD e pede CPF
3. Envie um CPF válido com boletos em aberto
4. **Resultado esperado**: Sistema mostra menu de formato:
   ```
   📋 *Escolha o formato da 2ª via:*
   
   [1] 📄 PDF
   [2] 📊 Código de barras
   [3] 🔢 Linha digitável
   
   Digite o número da opção desejada:
   ```

#### 4.1. Teste - Formato PDF
1. Envie "1"
2. **Resultado esperado**:
   - Sistema obtém PDF do Sicoob (via Base64)
   - PDF é salvo no Google Drive
   - PDF é enviado via WhatsApp como documento
   - Mensagem de confirmação: "✅ PDF da 2ª via enviado com sucesso!"
   - Registro no Google Sheets com `tipoSolicitacao: segunda_via_pdf`

#### 4.2. Teste - Formato Código de Barras
1. Envie "2"
2. **Resultado esperado**:
   - Sistema obtém dados do boleto
   - Código de barras é enviado via WhatsApp (sem formatação que atrapalhe copiar)
   - Mensagem contém: "📊 *Código de barras do boleto:*"
   - Registro no Google Sheets com `tipoSolicitacao: segunda_via_codigo_barras`

#### 4.3. Teste - Formato Linha Digitável
1. Envie "3"
2. **Resultado esperado**:
   - Sistema obtém dados do boleto
   - Linha digitável é enviada via WhatsApp
   - Mensagem contém: "🔢 *Linha digitável do boleto:*"
   - Instrução: "Copie e cole no app do seu banco para pagar"
   - Registro no Google Sheets com `tipoSolicitacao: segunda_via_linha_digitavel`

### 5. Validação do Fluxo - Segunda Via (múltiplos títulos)

1. Envie "1" ou "segunda via"
2. Envie um CPF válido com múltiplos boletos em aberto
3. **Resultado esperado**: Sistema lista os boletos:
   ```
   📋 Encontrei 3 boletos em aberto. Por favor, escolha qual deseja gerar a 2ª via:
   
   1 - Valor: R$ 100.50 | Vencimento: 31/12/2024
   2 - Valor: R$ 200.75 | Vencimento: 30/11/2024
   3 - Valor: R$ 300.00 | Vencimento: 31/10/2024
   
   Digite o número da opção desejada:
   ```
4. Escolha um título (ex: "1")
5. **Resultado esperado**: Sistema mostra menu de formato (mesmo do passo 4)
6. Escolha um formato e valide conforme seções 4.1, 4.2 ou 4.3

### 6. Validação - Funcionalidade "Voltar"

1. No menu de formato, envie "0" ou "voltar"
2. **Resultado esperado**: Sistema retorna para a lista de títulos (se houver múltiplos)

### 7. Validação de Erros

#### 7.1. CPF Inválido
1. Envie "1" ou "segunda via"
2. Envie um CPF inválido (ex: "12345678900")
3. **Resultado esperado**: Mensagem de erro: "❌ CPF inválido. Por favor, digite um CPF válido"

#### 7.2. Nenhum Boleto Encontrado
1. Envie "1" ou "segunda via"
2. Envie um CPF válido sem boletos em aberto
3. **Resultado esperado**: Mensagem: "❌ Nenhum boleto em aberto encontrado para este CPF"

#### 7.3. PDF Não Disponível
1. Escolha formato PDF
2. Se o Sicoob não retornar PDF (cenário de erro)
3. **Resultado esperado**: Mensagem amigável: "❌ Não foi possível gerar o PDF agora. Tente novamente ou escolha linha digitável/código de barras"

#### 7.4. Opção Inválida no Menu de Formato
1. No menu de formato, envie uma opção inválida (ex: "99")
2. **Resultado esperado**: Mensagem: "❌ Opção inválida. Por favor, escolha 1 (PDF), 2 (Código de barras), 3 (Linha digitável) ou 0 (Voltar)"

### 8. Validação de Logs

Verifique os logs do servidor para garantir:

- [ ] **Nenhum CPF puro aparece nos logs** (apenas mascarado: `***.***.***-XX`)
- [ ] **Nenhum token/client_secret aparece nos logs**
- [ ] Logs estruturados com `requestId` para rastreabilidade
- [ ] Erros são logados com contexto adequado (sem dados sensíveis)

**Exemplo de log esperado:**
```json
{
  "level": "info",
  "requestId": "abc-123",
  "from": "5511999999999",
  "cpfMasked": "***.***.***-99",
  "nossoNumero": "123456",
  "format": "PDF",
  "msg": "Processando escolha de formato"
}
```

### 9. Validação no Google Sheets

Verifique a planilha do Google Sheets:

- [ ] Novas solicitações são registradas
- [ ] Campo `tipoSolicitacao` está preenchido corretamente:
  - `segunda_via_pdf` para PDF
  - `segunda_via_codigo_barras` para código de barras
  - `segunda_via_linha_digitavel` para linha digitável
- [ ] Campo `drive_file_id` está preenchido apenas para PDF
- [ ] Nenhum CPF puro aparece (apenas `cpf_hash` e `cpf_masked`)

### 10. Validação no Google Drive

- [ ] PDFs são salvos na pasta privada configurada
- [ ] Nome do arquivo segue o padrão seguro (não contém CPF puro, a menos que `ALLOW_RAW_CPF_IN_FILENAME=true`)
- [ ] Apenas PDFs são salvos (não código de barras ou linha digitável)

## 🔍 Validação Técnica - API Sicoob

### Endpoints Utilizados

1. **Autenticação OAuth**
   - `POST {SICOOB_AUTH_TOKEN_URL}`
   - Headers: `Content-Type: application/x-www-form-urlencoded`
   - Body: `grant_type=client_credentials&client_id=...&client_secret=...`

2. **Segunda Via com PDF**
   - `GET {SICOOB_BASE_URL}/boletos/segunda-via?gerarPdf=true&numeroCliente=...&codigoModalidade=...&nossoNumero=...`
   - Headers: `Authorization: Bearer <token>`, `client_id: <clientId>`
   - Resposta: JSON com `resultado.pdfBoleto` (Base64)

3. **Dados do Boleto**
   - `GET {SICOOB_BASE_URL}/boletos/segunda-via?gerarPdf=false&numeroCliente=...&codigoModalidade=...&nossoNumero=...`
   - Headers: `Authorization: Bearer <token>`, `client_id: <clientId>`
   - Resposta: JSON com `resultado.linhaDigitavel`, `resultado.codigoBarras`, etc.

### Validação de Conversão Base64 → Buffer

- [ ] PDF Base64 é convertido corretamente para Buffer
- [ ] Buffer começa com `%PDF` (validação de PDF válido)
- [ ] PDF é enviado corretamente via WhatsApp

## 📝 Notas Importantes

1. **Sandbox**: Para testar sem afetar produção, use:
   ```env
   SICOOB_BASE_URL=https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3
   ```

2. **Rate Limiting**: O sistema tem rate limiting configurável. Se muitos testes forem feitos rapidamente, pode ser bloqueado temporariamente.

3. **Estado da Conversa**: O estado é armazenado em Redis (ou memória se Redis não estiver disponível) com TTL de 15 minutos por padrão.

4. **LGPD**: Todos os dados sensíveis são tratados conforme LGPD:
   - CPFs são hasheados antes de armazenar
   - CPFs são mascarados nos logs
   - Nenhum dado sensível vaza em logs ou planilhas

## 🐛 Troubleshooting

### Problema: Menu de formato não aparece
- **Causa**: Estado da conversa pode estar corrompido
- **Solução**: Limpe o estado (Redis ou reinicie o servidor) e tente novamente

### Problema: PDF não é gerado
- **Causa**: API do Sicoob pode não retornar `pdfBoleto` na resposta
- **Solução**: Verifique logs para ver a resposta da API. Use formato código de barras ou linha digitável como alternativa

### Problema: Erro 401/403 na API do Sicoob
- **Causa**: Credenciais inválidas ou token expirado
- **Solução**: Verifique `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET`. Verifique se o token está sendo renovado corretamente

### Problema: Erro 404 na API do Sicoob
- **Causa**: Boleto não encontrado ou parâmetros incorretos
- **Solução**: Verifique `SICOOB_NUMERO_CLIENTE`, `SICOOB_CODIGO_MODALIDADE` e `nossoNumero`

## ✅ Critérios de Aceite

O sistema está validado quando:

- [x] Todos os testes unitários passam (171/171)
- [ ] Build compila sem erros
- [ ] Health check retorna OK
- [ ] Menu principal aparece corretamente
- [ ] Menu de formato aparece após seleção de título
- [ ] PDF é gerado e enviado corretamente
- [ ] Código de barras é enviado corretamente
- [ ] Linha digitável é enviada corretamente
- [ ] Funcionalidade "voltar" funciona
- [ ] Erros são tratados adequadamente
- [ ] Logs não contêm dados sensíveis
- [ ] Google Sheets registra corretamente com `tipoSolicitacao`
- [ ] Google Drive salva apenas PDFs
- [ ] LGPD é respeitado em todos os pontos
