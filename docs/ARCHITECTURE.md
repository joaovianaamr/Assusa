# 🏗️ Arquitetura do Projeto Assusa

Este documento explica a arquitetura, estrutura e princípios de design do projeto Assusa.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Clean Architecture](#clean-architecture)
- [Estrutura de Diretórios](#estrutura-de-diretórios)
- [Camadas da Arquitetura](#camadas-da-arquitetura)
- [Organização dos Ports](#organização-dos-ports)
- [Fluxo de Dados](#fluxo-de-dados)
- [Princípios de Design](#princípios-de-design)
- [Benefícios](#benefícios)

## Visão Geral

O projeto Assusa segue os princípios da **Clean Architecture** (também conhecida como **Ports & Adapters** ou **Hexagonal Architecture**). Esta arquitetura organiza o código em camadas concêntricas, onde as regras de negócio ficam no centro, independentes de frameworks e bibliotecas externas.

```
┌─────────────────────────────────────────────────────────┐
│                    Adapters (Externos)                   │
│  (WhatsApp, Sicoob, Bradesco, Google, Redis, HTTP)      │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│     (Services, Use Cases, Ports de Integrações)         │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                      Domain Layer                        │
│      (Entities, Value Objects, Use Cases, Rules)        │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
│          (Config, Logging, Security, Utils)              │
└─────────────────────────────────────────────────────────┘
```

## Clean Architecture

### Princípios Fundamentais

1. **Independência de Frameworks** - Regras de negócio não dependem de frameworks externos
2. **Testabilidade** - Regras de negócio podem ser testadas sem UI, banco de dados ou serviços externos
3. **Independência de UI** - A interface pode mudar facilmente sem afetar o sistema
4. **Independência de Banco de Dados** - Podemos trocar Oracle por SQL Server, ou MongoDB
5. **Independência de Agentes Externos** - Regras de negócio não conhecem o mundo externo

### Camadas

O projeto é organizado em 4 camadas principais:

```
src/
├── domain/          # Regras de negócio puras
├── application/     # Casos de uso e orquestração
├── adapters/        # Implementações concretas
└── infrastructure/  # Configuração e utilidades
```

## Estrutura de Diretórios

```
assusa/
├── src/
│   ├── domain/                      # Camada de Domínio
│   │   ├── entities/                # Entidades de domínio
│   │   │   ├── boleto.ts
│   │   │   ├── request.ts
│   │   │   └── title.ts
│   │   ├── enums/                   # Enumeradores
│   │   │   ├── event-type.ts
│   │   │   ├── flow-type.ts
│   │   │   └── request-status.ts
│   │   ├── helpers/                 # Helpers de domínio
│   │   │   └── lgpd-helpers.ts
│   │   ├── ports/                   # Ports puramente de domínio (raros)
│   │   ├── use-cases/               # Use Cases de domínio
│   │   │   ├── gerar-segunda-via.ts
│   │   │   └── excluir-dados.ts
│   │   └── value-objects/           # Value Objects
│   │       └── cpf.ts
│   │
│   ├── application/                 # Camada de Aplicação
│   │   ├── dtos/                    # Data Transfer Objects
│   │   ├── ports/
│   │   │   └── driven/              # Ports de integrações externas
│   │   │       ├── whatsapp-port.ts
│   │   │       ├── sicoob-port.ts
│   │   │       ├── bradesco-port.ts
│   │   │       ├── drive-port.ts
│   │   │       ├── sheets-port.ts
│   │   │       ├── storage-port.ts
│   │   │       ├── rate-limiter.ts
│   │   │       └── logger.ts
│   │   ├── services/                # Serviços de aplicação
│   │   │   ├── application-service.ts
│   │   │   └── whatsapp-router.ts
│   │   └── use-cases/               # Use Cases de aplicação
│   │       ├── show-menu.ts
│   │       ├── start-second-copy-flow.ts
│   │       ├── generate-second-copy.ts
│   │       └── delete-data.ts
│   │
│   ├── adapters/                    # Camada de Adaptadores
│   │   ├── http/                    # Servidor Fastify
│   │   │   └── fastify-server.ts
│   │   ├── whatsapp/                # Adapter WhatsApp Cloud API
│   │   │   └── whatsapp-cloud-adapter.ts
│   │   ├── sicoob/                  # Adapter Sicoob API
│   │   │   └── sicoob-bank-provider-adapter.ts
│   │   ├── bradesco/                # Adapter Bradesco API
│   │   │   ├── bradesco-bank-provider-adapter.ts
│   │   │   └── aggregated-title-repository-adapter.ts
│   │   ├── google/                  # Adapters Google
│   │   │   ├── google-drive-adapter.ts
│   │   │   ├── google-sheets-adapter.ts
│   │   │   └── google-sheet-logger-adapter.ts
│   │   ├── redis/                   # Adapter Redis
│   │   │   └── redis-conversation-state-store.ts
│   │   └── in-memory/               # Implementações em memória
│   │       ├── in-memory-title-repository.ts
│   │       └── in-memory-conversation-state-store.ts
│   │
│   ├── infrastructure/              # Camada de Infraestrutura
│   │   ├── config/                  # Configuração
│   │   │   └── load-config.ts
│   │   ├── logging/                 # Logger (Pino)
│   │   │   └── logger.ts
│   │   └── security/                # Segurança/LGPD
│   │       └── cpf-handler.ts
│   │
│   └── main.ts                      # Entry point (bootstrap)
│
├── tests/
│   ├── unit/                        # Testes unitários
│   └── integration/                 # Testes de integração
│
└── docs/                            # Documentação
```

## Camadas da Arquitetura

### 1. Domain Layer (`src/domain/`)

A camada mais interna, contém as **regras de negócio puras**, sem dependências externas.

**Responsabilidades:**
- Entidades de domínio (Boleto, Request, Title)
- Value Objects (CPF)
- Use Cases de domínio (GerarSegundaVia, ExcluirDados)
- Regras de negócio e validações
- Ports puramente de domínio (raros, durante migração gradual)

**Características:**
- ✅ Não depende de nenhuma camada externa
- ✅ Pode ser testada isoladamente
- ✅ Não conhece APIs, bancos de dados, ou frameworks

**Exemplo:**
```typescript
// src/domain/value-objects/cpf.ts
export class Cpf {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('CPF inválido');
    }
  }
  
  private isValid(cpf: string): boolean {
    // Lógica de validação pura
  }
}
```

### 2. Application Layer (`src/application/`)

Orquestra os casos de uso e coordena a interação entre o domínio e os adaptadores.

**Responsabilidades:**
- Serviços de aplicação (ApplicationService, WhatsappRouter)
- Use Cases de aplicação (ShowMenu, StartSecondCopyFlow)
- **Ports de integrações externas** (`ports/driven/`): Interfaces para WhatsApp, Sicoob, Google, etc.
- DTOs (Data Transfer Objects)

**Características:**
- ✅ Depende apenas do Domain
- ✅ Define contratos (ports) para integrações externas
- ✅ Orquestra o fluxo de dados

**Exemplo:**
```typescript
// src/application/ports/driven/whatsapp-port.ts
export interface WhatsAppPort {
  sendMessage(to: string, message: string): Promise<void>;
}

// src/application/services/whatsapp-router.ts
export class WhatsappRouter {
  constructor(
    private whatsapp: WhatsAppPort,  // Port, não implementação
    private applicationService: ApplicationService
  ) {}
}
```

### 3. Adapters Layer (`src/adapters/`)

Implementações concretas das interfaces definidas pelos ports.

**Responsabilidades:**
- Implementar ports da camada de aplicação
- Integrar com APIs externas (WhatsApp, Sicoob, Bradesco, Google)
- Adaptar dados entre o formato externo e interno
- Gerenciar estado (Redis, in-memory)

**Características:**
- ✅ Implementa interfaces definidas em `application/ports/`
- ✅ Pode ser substituído facilmente (ex: trocar Redis por Memcached)
- ✅ Conhece detalhes de implementação das APIs externas

**Exemplo:**
```typescript
// src/adapters/whatsapp/whatsapp-cloud-adapter.ts
export class WhatsAppCloudAdapter implements WhatsAppPort {
  async sendMessage(to: string, message: string): Promise<void> {
    // Implementação usando WhatsApp Cloud API
  }
}
```

### 4. Infrastructure Layer (`src/infrastructure/`)

Utilitários e configurações que são usados em todas as camadas.

**Responsabilidades:**
- Configuração (loadConfig)
- Logging (Logger com Pino)
- Segurança/LGPD (CpfHandler)
- Utilitários gerais

**Características:**
- ✅ Usado por todas as camadas
- ✅ Não contém regras de negócio
- ✅ Fornece ferramentas e utilidades

## Organização dos Ports

### Ports de Integrações Externas

**Localização**: `src/application/ports/driven/`

**Critério**: Se o nome do port "parece integração", ele NÃO é domínio.

**Exemplos:**
- `WhatsAppPort` - Integração com WhatsApp
- `SicoobPort` - Integração com Sicoob API
- `BradescoPort` - Integração com Bradesco API
- `DrivePort` - Integração com Google Drive
- `SheetsPort` - Integração com Google Sheets
- `StoragePort` - Integração com armazenamento
- `RateLimiter` - Limitação de taxa
- `Logger` - Sistema de logging

**Motivo**: Estes ports representam integrações externas e devem estar na camada de aplicação, não no domínio.

### Ports Puramente de Domínio

**Localização**: `src/domain/ports/` (raros, durante migração gradual)

**Critério**: Genéricos, abstratos, não são integrações específicas.

**Exemplos:**
- `Clock` - Abstração de tempo
- `IdGenerator` - Geração de IDs
- `Hasher` - Hash de dados
- `RandomProvider` - Números aleatórios

**Nota**: Durante a migração gradual, alguns ports podem estar em `domain/ports/` temporariamente. Ver [ADR-0001](adr/ADR-0001-ports-na-application.md) para detalhes.

## Fluxo de Dados

### Exemplo: Gerar 2ª Via de Boleto

```
1. WhatsApp recebe mensagem
   ↓
2. Adapter HTTP (Fastify) recebe requisição
   ↓
3. ApplicationService orquestra o fluxo
   ↓
4. Use Case GenerateSecondCopy executa lógica
   ↓
5. Use Case usa SicoobPort (interface)
   ↓
6. SicoobBankProviderAdapter (implementação) busca dados
   ↓
7. Dados retornam ao Use Case
   ↓
8. Use Case processa com regras de domínio
   ↓
9. Use Case usa DrivePort para salvar PDF
   ↓
10. GoogleDriveAdapter salva no Drive
   ↓
11. Use Case usa WhatsAppPort para enviar mensagem
   ↓
12. WhatsAppCloudAdapter envia mensagem
```

**Benefício**: Cada camada conhece apenas a camada abaixo. Isso facilita testes e manutenção.

## Princípios de Design

### 1. Dependency Inversion

Camadas externas dependem de interfaces (ports) definidas em camadas internas, não de implementações.

```typescript
// ❌ Errado: Dependência direta
class UseCase {
  constructor(private sicoob: SicoobAdapter) {}  // Depende de implementação
}

// ✅ Correto: Dependência de interface
class UseCase {
  constructor(private sicoob: SicoobPort) {}  // Depende de interface
}
```

### 2. Single Responsibility

Cada classe/função tem uma única responsabilidade bem definida.

### 3. Open/Closed Principle

Aberto para extensão, fechado para modificação. Novos adaptadores podem ser adicionados sem modificar código existente.

### 4. Interface Segregation

Interfaces pequenas e focadas. Ex: `DrivePort`, `SheetsPort`, ao invés de um único `GooglePort`.

## Benefícios

### ✅ Testabilidade

- Regras de negócio podem ser testadas sem APIs reais
- Mocks fáceis através de interfaces (ports)
- Testes rápidos e isolados

### ✅ Flexibilidade

- Trocar WhatsApp por Telegram: apenas criar novo adapter
- Trocar Redis por Memcached: apenas criar novo adapter
- Adicionar novo banco: implementar `BankProviderPort`

### ✅ Manutenibilidade

- Código organizado por responsabilidade
- Fácil localizar onde fazer mudanças
- Baixo acoplamento entre componentes

### ✅ Escalabilidade

- Fácil adicionar novas funcionalidades
- Fácil adicionar novos canais (site, app, email)
- Fácil adicionar novos bancos

### ✅ Independência de Frameworks

- Regras de negócio não dependem de Fastify, Pino, etc.
- Se necessário trocar framework, apenas os adapters mudam

## Referências

- [ADR-0001: Ports na Application Layer](adr/ADR-0001-ports-na-application.md) - Decisão arquitetural sobre localização de ports
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
