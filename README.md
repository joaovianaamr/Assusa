# Assusa - Chatbot WhatsApp para 2ª Via de Boletos

Sistema de chatbot no WhatsApp para geração de 2ª via de boletos bancários com suporte a múltiplos bancos (Sicoob e Bradesco), desenvolvido com compliance total à LGPD e seguindo Clean Architecture.

## 🚀 Início Rápido

```bash
# 1. Clone e instale as dependências
git clone <repository-url>
cd assusa
npm install

# 2. Configure as variáveis de ambiente
# Copie o template de docs/ENV_TEMPLATE.md para .env
# Preencha todas as variáveis obrigatórias

# 3. Valide a configuração
npm run validate-config

# 4. Execute em modo desenvolvimento
npm run dev
```

📖 **Documentação Completa**: Veja [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) para um guia passo a passo detalhado.

## ✨ Características Principais

- ✅ **Compliance total com LGPD** - Proteção de dados desde o design
- ✅ **Clean Architecture** - Código organizado e testável
- ✅ **Múltiplos bancos** - Suporte a Sicoob e Bradesco
- ✅ **Detecção de duplicidade** - Identifica boletos duplicados entre bancos
- ✅ **Observabilidade completa** - Logs estruturados e rastreabilidade
- ✅ **Testes automatizados** - Cobertura de testes unitários e de integração
- ✅ **Deploy no Google Cloud Run** - Escalável e gerenciado

## 📚 Documentação

Nossa documentação está organizada para ser intuitiva e fácil de navegar:

### 🎯 Para Começar
- **[Guia de Início Rápido](docs/GETTING_STARTED.md)** - Configure e execute o projeto em poucos minutos
- **[Setup Detalhado](docs/SETUP.md)** - Configuração completa passo a passo

### ⚙️ Configuração
- **[Configuração Completa](docs/CONFIGURATION.md)** - Todas as variáveis de ambiente e configurações detalhadas
- **[Integrações de APIs](docs/API_INTEGRATIONS.md)** - Configuração de WhatsApp, Sicoob, Bradesco e Google APIs

### 🏗️ Arquitetura e Desenvolvimento
- **[Arquitetura do Projeto](docs/ARCHITECTURE.md)** - Estrutura, camadas e princípios de design
- **[Desenvolvimento](docs/DEVELOPMENT.md)** - DevTools, testes, troubleshooting e boas práticas

### 🚢 Deploy e Operação
- **[Deploy no Google Cloud Run](docs/DEPLOY.md)** - Guia completo de deploy em produção
- **[Validação Manual](docs/VALIDACAO_MANUAL.md)** - Guia de validação manual do fluxo completo
- **[Sicoob API](docs/SICOOB.md)** - Documentação específica da integração com Sicoob

### 📋 Documentação Adicional
- **[Changelog de Implementação](docs/CHANGELOG_IMPLEMENTACAO.md)** - Histórico de mudanças e implementações

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|-----------|
| **Runtime** | Node.js 20+ |
| **Linguagem** | TypeScript |
| **Framework HTTP** | Fastify |
| **Validação** | Zod |
| **Cache/Estado** | Redis (com fallback em memória) |
| **Logging** | Pino (logs estruturados) |
| **Testes** | Vitest |
| **Deploy** | Google Cloud Run |
| **APIs Externas** | WhatsApp Cloud API, Sicoob API, Bradesco API, Google Drive/Sheets |

## 📦 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Executar com hot-reload
npm run build            # Compilar TypeScript
npm start                # Executar versão compilada

# Testes
npm test                 # Executar todos os testes
npm run test:coverage    # Testes com cobertura de código

# Qualidade de Código
npm run validate-config  # Validar variáveis de ambiente
npm run lint             # Verificar código com ESLint
npm run type-check       # Verificar tipos TypeScript

# Health Check
curl http://localhost:3000/health
```

## 🔒 LGPD e Segurança

O projeto foi desenvolvido com foco total em compliance com a LGPD:

- **CPF Hash**: CPFs armazenados apenas como hash SHA256 + pepper
- **Máscara**: CPFs mascarados em logs (XXX.XXX.XXX-XX)
- **Logs Sanitizados**: CPFs nunca aparecem em logs
- **Pasta Privada**: PDFs salvos em pasta privada no Google Drive
- **Exclusão de Dados**: Cliente pode solicitar exclusão completa via comando

📖 Saiba mais sobre [LGPD e Segurança em docs/DEVELOPMENT.md#lgpd-e-segurança](docs/DEVELOPMENT.md#lgpd-e-segurança)

## 🏗️ Estrutura do Projeto

```
assusa/
├── src/
│   ├── domain/          # Regras de negócio puras
│   ├── application/     # Serviços e casos de uso
│   ├── adapters/        # Implementações concretas (WhatsApp, bancos, Google)
│   └── infrastructure/  # Configuração, logging, segurança
├── tests/               # Testes unitários e de integração
├── docs/                # Documentação completa
└── scripts/             # Scripts utilitários
```

📖 Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para entender a arquitetura em detalhes.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

📖 Veja [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) para padrões de código e boas práticas.

## 📞 Suporte

- **Email comercial:** [aguavaledoouro@gmail.com](mailto:aguavaledoouro@gmail.com)
- **Email técnico:** [joaovianaamr@gmail.com](mailto:joaovianaamr@gmail.com)
- **WhatsApp Assusa:**
  - (31) 8549-7547
  - (31) 3624-8550
- **WhatsApp suporte técnico:** (31) 99475-6008

## 📄 Licença

Este projeto está sob a licença MIT.

---

**Desenvolvido com ❤️ seguindo as melhores práticas de Clean Architecture e LGPD.**
