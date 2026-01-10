# Assusa - Chatbot WhatsApp para 2ª Via de Boletos

Sistema de chatbot no WhatsApp para geração de 2ª via de boletos bancários usando a API do Sicoob, com compliance total à LGPD.

## 📋 Índice

- [Sobre](#sobre)
- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [LGPD e Segurança](#lgpd-e-segurança)
- [Testes](#testes)
- [Deploy](#deploy)
- [Estrutura do Projeto](#estrutura-do-projeto)

## 🎯 Sobre

O Assusa é um chatbot desenvolvido para WhatsApp que permite aos clientes solicitar a 2ª via de boletos bancários de forma rápida e segura. O sistema foi desenvolvido seguindo os princípios da **Clean Architecture** (Ports & Adapters) para garantir flexibilidade, testabilidade e fácil manutenção.

### Principais Características

- ✅ Compliance total com LGPD
- ✅ Arquitetura limpa e escalável
- ✅ Suporte a múltiplos canais (preparado para site/app/email)
- ✅ Suporte a múltiplos bancos (atualmente Sicoob)
- ✅ Observabilidade completa
- ✅ Testes automatizados
- ✅ Deploy no Google Cloud Run

## 🏗️ Arquitetura

O projeto segue a **Clean Architecture** (Ports & Adapters), dividida em camadas:

```
src/
├── domain/          # Regras de negócio puras (entities, ports, use-cases)
├── application/     # Casos de uso e orquestração
├── adapters/        # Implementações concretas (WhatsApp, Sicoob, Google, Redis)
└── infrastructure/  # Configuração, logging, segurança
```

### Camadas

1. **Domain** (`domain/`): Entidades, portas (interfaces) e casos de uso
2. **Application** (`application/`): Serviços que orquestram os casos de uso
3. **Adapters** (`adapters/`): Implementações concretas das portas
4. **Infrastructure** (`infrastructure/`): Configuração, logging, segurança

### Benefícios da Arquitetura

- **Desacoplamento**: Facilita a troca de implementações (ex: trocar Redis por Memcached)
- **Testabilidade**: Permite criar mocks facilmente
- **Extensibilidade**: Adicionar novos bancos ou canais é simples
- **Manutenibilidade**: Código organizado e fácil de entender

## 🛠️ Stack Tecnológica

- **Runtime**: Node.js 20+
- **Linguagem**: TypeScript
- **Framework HTTP**: Fastify
- **Validação**: Zod
- **Cache/Estado**: Redis (com fallback em memória)
- **Logging**: Pino (logs estruturados)
- **APIs Externas**:
  - WhatsApp Cloud API
  - Sicoob API
  - Google Drive API
  - Google Sheets API
- **Testes**: Vitest
- **Deploy**: Google Cloud Run

## ✨ Funcionalidades

### Fluxo Principal: Gerar 2ª Via de Boleto

1. Cliente envia mensagem no WhatsApp
2. Sistema apresenta menu interativo
3. Cliente seleciona "Gerar 2ª via de boleto"
4. Sistema exibe aviso LGPD
5. Cliente informa CPF
6. Sistema busca boletos no Sicoob
7. Sistema gera PDF da 2ª via
8. PDF é salvo no Google Drive (pasta privada)
9. Solicitação é registrada no Google Sheets
10. PDF é enviado ao cliente via WhatsApp

### Outras Funcionalidades

- **Fale com a gente**: Exibe informações de contato
- **Acessar nosso site**: Exibe link do site
- **EXCLUIR DADOS (LGPD)**: Permite que o cliente solicite exclusão de todos os seus dados

## 📦 Requisitos

- Node.js 20 ou superior
- npm ou yarn
- Redis (opcional - tem fallback em memória)
- Contas/configurações:
  - WhatsApp Business Cloud API
  - Sicoob API (credenciais e certificados)
  - Google Cloud Project (com APIs habilitadas):
    - Google Drive API
    - Google Sheets API

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd assusa
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (veja seção [Configuração](#configuração))

4. Compile o projeto:
```bash
npm run build
```

5. Execute o projeto:
```bash
npm start
```

Para desenvolvimento com hot-reload:
```bash
npm run dev
```

## ⚙️ Configuração

Copie o arquivo `.env.example` para `.env` e preencha as variáveis:

```bash
cp .env.example .env
```

### Variáveis de Ambiente

#### Servidor
- `NODE_ENV`: Ambiente (development/production/test)
- `PORT`: Porta do servidor (padrão: 3000)
- `HOST`: Host do servidor (padrão: 0.0.0.0)

#### WhatsApp Cloud API
- `WHATSAPP_API_TOKEN`: Token de acesso da API do WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone no WhatsApp
- `WHATSAPP_VERIFY_TOKEN`: Token de verificação do webhook
- `WHATSAPP_WEBHOOK_URL`: URL pública do webhook (opcional)

#### Sicoob API
- `SICOOB_CLIENT_ID`: Client ID da aplicação Sicoob
- `SICOOB_CLIENT_SECRET`: Client Secret da aplicação Sicoob
- `SICOOB_BASE_URL`: URL base da API Sicoob (padrão: https://api.sicoob.com.br)
- `SICOOB_CERTIFICATE_PATH`: Caminho do certificado SSL (opcional)
- `SICOOB_KEY_PATH`: Caminho da chave privada SSL (opcional)

#### Google APIs
- `GOOGLE_CLIENT_EMAIL`: Email da service account do Google
- `GOOGLE_PRIVATE_KEY`: Chave privada da service account (com \n escapados)
- `GOOGLE_PROJECT_ID`: ID do projeto no Google Cloud
- `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta no Google Drive onde os PDFs serão salvos
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID da planilha do Google Sheets
- `GOOGLE_SHEETS_WORKSHEET_NAME`: Nome da aba na planilha (padrão: Requests)

#### Redis
- `REDIS_URL`: URL de conexão do Redis (ex: redis://localhost:6379)
- `REDIS_ENABLED`: Habilitar Redis (true/false, padrão: true)

#### Segurança & LGPD
- `CPF_PEPPER`: String secreta para hash do CPF (mínimo 32 caracteres) - **OBRIGATÓRIO**
- `ALLOW_RAW_CPF_IN_FILENAME`: Permitir CPF puro em nomes de arquivo (true/false, padrão: false)
- `DATA_RETENTION_DAYS`: Dias de retenção de dados (padrão: 90)

#### Observabilidade
- `LOG_LEVEL`: Nível de log (fatal/error/warn/info/debug/trace, padrão: info)
- `SERVICE_NAME`: Nome do serviço para logs (padrão: assusa)

#### Rate Limiting
- `RATE_LIMIT_MAX_REQUESTS`: Máximo de requisições por janela (padrão: 100)
- `RATE_LIMIT_WINDOW_MS`: Janela de tempo em milissegundos (padrão: 60000 = 1 minuto)

### Configuração do WhatsApp

1. Configure o webhook no WhatsApp Business:
   - URL: `https://seu-dominio.com/webhook`
   - Método: GET (para verificação) e POST (para mensagens)
   - Token de verificação: Use o valor de `WHATSAPP_VERIFY_TOKEN`

### Configuração do Google Cloud

1. Crie uma Service Account no Google Cloud Console
2. Habilite as APIs necessárias:
   - Google Drive API
   - Google Sheets API
3. Baixe a chave JSON da service account
4. Extraia o `client_email` e `private_key` para as variáveis de ambiente
5. Compartilhe a pasta do Drive e a planilha com o email da service account

### Configuração do Sicoob

1. Obtenha credenciais da API do Sicoob
2. Se necessário, configure certificados SSL (PEM format)

## 💻 Uso

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (com hot-reload)
npm run dev

# Compilar
npm run build

# Executar
npm start
```

### Testes

```bash
# Rodar testes
npm test

# Rodar testes com coverage
npm run test:coverage
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 🔒 LGPD e Segurança

O projeto foi desenvolvido com foco total em compliance com a LGPD. As principais medidas implementadas:

### Proteção de Dados Sensíveis

1. **CPF Hash**: CPFs são armazenados apenas como hash SHA256 + pepper
2. **Máscara**: CPFs são mascarados em logs e interfaces (XXX.XXX.XXX-XX)
3. **Logs Sanitizados**: CPFs nunca aparecem em logs (são removidos/mascarados)
4. **Pasta Privada**: PDFs são salvos em pasta privada no Google Drive
5. **Política de Retenção**: Dados são retidos apenas pelo período configurado

### Funcionalidades LGPD

- **Minimização de Dados**: Apenas dados estritamente necessários são coletados
- **Comando EXCLUIR DADOS**: Cliente pode solicitar exclusão completa de seus dados
- **Auditoria**: Todas as operações são registradas no Google Sheets para auditoria

### Nomes de Arquivo

Por padrão, os arquivos no Drive **NÃO** contêm CPF puro. Isso é controlado pela variável `ALLOW_RAW_CPF_IN_FILENAME`:

- `false` (padrão): Nome do arquivo: `boleto-{nossoNumero}-{timestamp}.pdf`
- `true`: Nome do arquivo: `boleto-{nossoNumero}-{cpf}.pdf`

## 🧪 Testes

### Estrutura de Testes

```
tests/
├── unit/          # Testes unitários
└── integration/   # Testes de integração
```

### Executar Testes

```bash
# Todos os testes
npm test

# Com coverage
npm run test:coverage

# Apenas testes unitários
npm test -- tests/unit

# Apenas testes de integração
npm test -- tests/integration
```

### Exemplos de Testes

- Validação de CPF (formato, dígitos verificadores)
- Hash de CPF com pepper
- Sanitização de logs
- Fluxo do WhatsApp Service
- Integrações com APIs externas (mocks)

## 🚢 Deploy

### Google Cloud Run

1. Configure o gcloud CLI:
```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
```

2. Crie um Dockerfile (veja exemplo abaixo)

3. Build e deploy:
```bash
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/assusa
gcloud run deploy assusa \
  --image gcr.io/SEU_PROJECT_ID/assusa \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

4. Configure as variáveis de ambiente no Cloud Run

### Dockerfile Exemplo

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## 📁 Estrutura do Projeto

```
assusa/
├── src/
│   ├── domain/
│   │   ├── entities/          # Entidades de domínio
│   │   ├── ports/             # Interfaces (contratos)
│   │   └── use-cases/         # Casos de uso
│   ├── application/
│   │   └── services/          # Serviços de aplicação
│   ├── adapters/
│   │   ├── http/              # Servidor Fastify
│   │   ├── whatsapp/          # Adapter WhatsApp Cloud API
│   │   ├── sicoob/            # Adapter Sicoob API
│   │   ├── google/            # Adapters Google Drive/Sheets
│   │   └── redis/             # Adapter Redis (com fallback)
│   ├── infrastructure/
│   │   ├── config/            # Configuração
│   │   ├── logging/           # Logger (Pino)
│   │   └── security/          # Segurança/LGPD (CPF handler)
│   └── main.ts                # Entry point
├── tests/
│   ├── unit/                  # Testes unitários
│   └── integration/           # Testes de integração
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## 🔧 Troubleshooting

### Redis não disponível

O sistema tem fallback automático para memória quando Redis não está disponível. Um aviso será exibido nos logs.

### Erro de autenticação do Google

- Verifique se o `GOOGLE_PRIVATE_KEY` está corretamente formatado (com `\n` escapados)
- Confirme que a service account tem permissões necessárias
- Verifique se as APIs estão habilitadas no Google Cloud Console

### Erro de autenticação do Sicoob

- Verifique se `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET` estão corretos
- Se usar certificados SSL, verifique os caminhos
- Confirme que as credenciais têm permissões necessárias

### CPF não encontrado

- Verifique se o CPF está sendo enviado corretamente
- Confirme que o hash está sendo gerado corretamente (mesmo pepper)
- Verifique a integração com a API do Sicoob

## 📝 Notas Importantes

1. **CPF_PEPPER**: Esta é uma variável crítica. Nunca compartilhe ou commite. Use um gerador de strings seguras (ex: `openssl rand -hex 32`).

2. **Logs**: CPFs nunca aparecem em logs. Se encontrar um CPF em logs, reporte imediatamente como bug de segurança.

3. **Google Drive**: A pasta configurada deve ser privada. Apenas a service account deve ter acesso.

4. **Redis**: Em produção, use sempre Redis. O fallback em memória é apenas para desenvolvimento.

5. **Sicoob API**: A implementação atual é um exemplo. Adapte conforme a documentação real da API do Sicoob.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 📞 Suporte

Para suporte, entre em contato através dos canais:
- Email: contato@assusa.com.br
- WhatsApp: (00) 0 0000-0000

---

**Desenvolvido com ❤️ seguindo as melhores práticas de Clean Architecture e LGPD.**
