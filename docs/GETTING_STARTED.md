# 🚀 Guia de Início Rápido

Este guia ajudará você a configurar e executar o projeto Assusa em poucos minutos.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm** ou **yarn** - Vem com Node.js
- **Git** - [Download](https://git-scm.com/)

## ⚡ Instalação Rápida

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd assusa
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# No Windows (PowerShell)
New-Item .env -ItemType File

# No Linux/Mac
touch .env
```

Copie o template de `docs/ENV_TEMPLATE.md` e preencha as variáveis obrigatórias.

**Variáveis Obrigatórias Mínimas para Testar:**

```env
# Segurança (GERE UMA STRING SEGURA!)
CPF_PEPPER=SUA_STRING_SECRETA_MINIMO_32_CARACTERES

# WhatsApp (para testar localmente, alguns campos podem ser opcionais)
WHATSAPP_API_TOKEN=seu_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_VERIFY_TOKEN=seu_verify_token

# Google (se não tiver, alguns recursos não funcionarão)
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=seu_json_base64
GOOGLE_DRIVE_FOLDER_ID=seu_folder_id
GOOGLE_SHEETS_SPREADSHEET_ID=seu_spreadsheet_id

# Sicoob e Bradesco (opcional para início - adicione depois)
# SICOOB_CLIENT_ID=...
# BRADESCO_CLIENT_ID=...
```

**Importante**: Para gerar uma string segura para `CPF_PEPPER`:

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### 4. Valide a Configuração

```bash
npm run validate-config
```

Este comando verifica se todas as variáveis obrigatórias estão configuradas corretamente.

### 5. Execute o Projeto

#### Modo Desenvolvimento (Recomendado)

```bash
npm run dev
```

O servidor será iniciado com hot-reload em `http://localhost:3000`

#### Modo Produção

```bash
# Primeiro, compile o TypeScript
npm run build

# Depois, execute
npm start
```

### 6. Verifique se Está Funcionando

```bash
# Health check
curl http://localhost:3000/health
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T18:00:00.000Z"
}
```

## 🎯 Próximos Passos

Agora que o projeto está rodando:

1. **Configure as Integrações**: Veja [docs/CONFIGURATION.md](CONFIGURATION.md) para configurar WhatsApp, Sicoob, Bradesco e Google APIs
2. **Teste o DevTools**: Habilite o DevTools Flow Tester (veja [docs/DEVELOPMENT.md](DEVELOPMENT.md#devtools-flow-tester))
3. **Execute os Testes**: `npm test`
4. **Explore a Documentação**: Navegue pelos outros arquivos em `docs/`

## 🐛 Problemas Comuns

### Erro: "Cannot find module"

```bash
# Reinstale as dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro de Validação de Configuração

- Verifique se todas as variáveis obrigatórias estão preenchidas
- Confirme que os valores estão no formato correto
- Veja `docs/CONFIGURATION.md` para referência completa

### Redis não disponível

O sistema tem fallback automático para memória. Você verá um aviso nos logs, mas o sistema continuará funcionando.

Para produção, recomenda-se usar Redis. Veja [docs/CONFIGURATION.md](CONFIGURATION.md#redis) para configuração.

## 📚 Mais Informações

- **Configuração Detalhada**: [docs/CONFIGURATION.md](CONFIGURATION.md)
- **Setup Completo**: [docs/SETUP.md](SETUP.md)
- **Arquitetura**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **Desenvolvimento**: [docs/DEVELOPMENT.md](DEVELOPMENT.md)
