# 💻 Guia de Desenvolvimento

Este documento cobre tópicos relacionados ao desenvolvimento do projeto Assusa, incluindo DevTools, testes, troubleshooting e boas práticas.

## 📋 Índice

- [DevTools Flow Tester](#devtools-flow-tester)
- [Testes](#testes)
- [Scripts Disponíveis](#scripts-disponíveis)
- [LGPD e Segurança](#lgpd-e-segurança)
- [Troubleshooting](#troubleshooting)
- [Boas Práticas](#boas-práticas)
- [Estrutura de Testes](#estrutura-de-testes)

## DevTools Flow Tester

O DevTools Flow Tester é uma ferramenta que permite testar o fluxo do chatbot sem depender do WhatsApp real. É útil para desenvolvimento e depuração.

### Habilitar DevTools

Configure no arquivo `.env`:

```env
DEV_TOOLS_ENABLED=true
# Opcional: Token para autenticação
DEV_TOOLS_TOKEN=seu-token-secreto
```

**Importante**: O DevTools **não funciona em produção** (`NODE_ENV=production`). Ele só é habilitado quando:
- `NODE_ENV !== 'production'` OU
- `DEV_TOOLS_ENABLED=true` explicitamente

### Acessar Interface

Após iniciar o servidor, acesse:

```
http://localhost:3000/devtools/flow-tester
```

### Funcionalidades

1. **Escolher ponto de partida**: Permite iniciar o teste em diferentes pontos do fluxo:
   - `MENU`: Estado inicial (menu)
   - `LGPD_NOTICE`: Após aceitar termos LGPD
   - `WAITING_CPF`: Aguardando CPF
   - `SELECT_TITLE`: Aguardando seleção de título
   - `SELECT_FORMAT`: Aguardando seleção de formato
   - `CONFIRM`: Estado intermediário
   - `DONE`: Fluxo concluído

2. **Enviar mensagens**: Simula mensagens do WhatsApp para testar o fluxo

3. **Visualizar estado**: Ver estado atual da conversa após cada interação

4. **Resetar estado**: Limpar o estado de uma conversa para começar novo teste

### Endpoints da API

#### GET `/devtools/flow-tester`

Retorna a interface HTML do Flow Tester.

#### POST `/devtools/flow-tester/run`

Executa o fluxo com uma mensagem de entrada.

**Payload:**
```json
{
  "from": "5511999999999",
  "input": {
    "type": "text",
    "text": "menu"
  },
  "startAt": "WAITING_CPF",  // Opcional
  "stateOverride": {}         // Opcional
}
```

**Resposta:**
```json
{
  "requestId": "uuid",
  "outgoingMessages": [],
  "stateAfter": {
    "activeFlow": "SECOND_COPY",
    "step": "WAITING_SELECTION",
    "data": {},
    "updatedAt": "2024-01-12T18:00:00.000Z"
  },
  "debug": {
    "matchedHandler": "WhatsappRouter",
    "timings": { ... }
  }
}
```

#### POST `/devtools/flow-tester/reset`

Limpa o estado da conversa para um remetente.

**Payload:**
```json
{
  "from": "5511999999999"
}
```

#### GET `/devtools/flow-tester/state?from=5511999999999`

Retorna o estado atual da conversa.

### Segurança

- DevTools bloqueado automaticamente em produção
- Token de autenticação opcional via header `x-dev-tools-token`
- Nenhum dado sensível é exposto (CPFs são sanitizados)

## Testes

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

# Testes em modo watch (desenvolvimento)
npm test -- --watch
```

### Estrutura de Testes

```
tests/
├── unit/                  # Testes unitários
│   ├── cpf-handler.test.ts
│   ├── whatsapp-router.test.ts
│   └── ...
└── integration/           # Testes de integração
    ├── health.test.ts
    └── devtools-flow-tester.test.ts
```

### Exemplos de Testes

#### Teste Unitário

```typescript
// tests/unit/cpf-handler.test.ts
import { describe, it, expect } from 'vitest';
import { CpfHandler } from '../../src/infrastructure/security/cpf-handler.js';

describe('CpfHandler', () => {
  it('deve hashar CPF corretamente', () => {
    const cpf = '12345678900';
    const hash = CpfHandler.hashCpf(cpf);
    expect(hash).toHaveLength(64); // SHA256
  });

  it('deve mascarar CPF corretamente', () => {
    const cpf = '12345678900';
    const masked = CpfHandler.maskCpf(cpf);
    expect(masked).toBe('XXX.XXX.XXX-00');
  });
});
```

#### Teste de Integração

```typescript
// tests/integration/health.test.ts
import { describe, it, expect } from 'vitest';
import { createServer } from '../../src/main.js';

describe('Health Check', () => {
  it('deve retornar status ok', async () => {
    const server = await createServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      timestamp: expect.any(String)
    });
  });
});
```

### Cobertura de Testes

O projeto usa Vitest para testes e cobertura. Execute:

```bash
npm run test:coverage
```

A cobertura será gerada no diretório `coverage/`.

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Executa em modo desenvolvimento com hot-reload |
| `npm run build` | Compila TypeScript para JavaScript |
| `npm start` | Executa versão compilada (após `npm run build`) |
| `npm test` | Executa todos os testes |
| `npm run test:coverage` | Executa testes com cobertura de código |
| `npm run validate-config` | Valida variáveis de ambiente |
| `npm run lint` | Verifica código com ESLint |
| `npm run type-check` | Verifica tipos TypeScript |

## LGPD e Segurança

### Proteção de Dados Sensíveis

O projeto implementa várias medidas de proteção de dados para compliance com LGPD:

#### 1. CPF Hash

CPFs são armazenados apenas como hash SHA256 + pepper. O CPF original nunca é armazenado.

```typescript
import { CpfHandler } from './infrastructure/security/cpf-handler.js';

const cpf = '12345678900';
const hash = CpfHandler.hashCpf(cpf); // Gera hash com pepper
```

#### 2. Máscara de CPF

CPFs são mascarados em logs e interfaces (XXX.XXX.XXX-XX).

```typescript
const masked = CpfHandler.maskCpf(cpf); // "XXX.XXX.XXX-00"
```

#### 3. Logs Sanitizados

CPFs nunca aparecem em logs. O sistema remove/mascara automaticamente.

**Importante**: Se encontrar um CPF em logs, reporte imediatamente como bug de segurança.

#### 4. Pasta Privada no Google Drive

PDFs são salvos em pasta privada no Google Drive. Apenas a service account e membros autorizados têm acesso.

#### 5. Política de Retenção

Dados são retidos apenas pelo período configurado em `DATA_RETENTION_DAYS` (padrão: 90 dias).

#### 6. Exclusão de Dados (LGPD)

Clientes podem solicitar exclusão completa de seus dados via comando `EXCLUIR DADOS` no WhatsApp.

### Funcionalidades LGPD

- **Minimização de Dados**: Apenas dados estritamente necessários são coletados
- **Comando EXCLUIR DADOS**: Cliente pode solicitar exclusão completa
- **Auditoria**: Todas as operações são registradas no Google Sheets para auditoria

### Nomes de Arquivo

Por padrão, os arquivos no Drive **NÃO** contêm CPF puro. Isso é controlado pela variável `ALLOW_RAW_CPF_IN_FILENAME`:

- `false` (padrão): `boleto-{nossoNumero}-{timestamp}.pdf`
- `true`: `boleto-{nossoNumero}-{cpf}.pdf`

**Recomendação**: Use `false` em produção para evitar expor CPFs nos nomes de arquivo.

### Variável Crítica: CPF_PEPPER

A variável `CPF_PEPPER` é crítica para segurança:

- **Nunca compartilhe ou commite**
- Mínimo de 32 caracteres
- Use um gerador de strings seguras: `openssl rand -hex 32`
- Se comprometida, todos os hashes precisarão ser regenerados

## Troubleshooting

### Redis não disponível

**Sintoma**: Aviso nos logs sobre Redis não disponível.

**Solução**: O sistema tem fallback automático para memória. Em produção, recomenda-se configurar Redis:

```env
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

### Erro de autenticação do Google

**Sintoma**: Erro ao autenticar no Google APIs.

**Soluções**:
1. Verifique se `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` está correto (JSON completo codificado em base64)
2. Confirme que a service account tem permissões necessárias (Editor no Drive e Sheets)
3. Verifique se as APIs estão habilitadas no Google Cloud Console:
   - Google Drive API
   - Google Sheets API

### Erro de autenticação do Sicoob

**Sintoma**: Erro 401/403 ao autenticar no Sicoob.

**Soluções**:
1. Verifique `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET`
2. Verifique `SICOOB_NUMERO_CLIENTE` e `SICOOB_CODIGO_MODALIDADE`
3. Se usar certificados SSL (mTLS), verifique os caminhos ou base64
4. Para sandbox, ajuste `SICOOB_BASE_URL`

📖 Veja [docs/SICOOB.md](SICOOB.md) para mais detalhes.

### Erro de autenticação do Bradesco

**Sintoma**: Erro ao autenticar no Bradesco.

**Soluções**:
1. Verifique `BRADESCO_CLIENT_ID`
2. Confirme que `BRADESCO_PRIVATE_KEY_PEM` está no formato PEM correto
3. Verifique se a chave privada corresponde ao certificado registrado no Bradesco
4. Confirme que `BRADESCO_BENEFICIARY_CNPJ` está correto (14 dígitos)

### CPF não encontrado

**Sintoma**: Sistema não encontra boletos para um CPF.

**Soluções**:
1. Verifique se o CPF está sendo enviado corretamente
2. Confirme que o hash está sendo gerado corretamente (mesmo pepper)
3. Verifique a integração com a API do banco (Sicoob/Bradesco)
4. Confirme que o CPF existe no banco de dados do banco

### Erros de TypeScript

**Sintoma**: Erros de tipo após instalar dependências.

**Solução**:
```bash
# Reinstale as dependências
rm -rf node_modules package-lock.json
npm install

# Verifique tipos
npm run type-check
```

## Boas Práticas

### 1. Commits

Siga o padrão **Conventional Commits**:

```
feat(escopo): descrição
fix(escopo): descrição
test: descrição
docs: descrição
chore: descrição
```

Exemplos:
- `feat(adapters): implementa adapter WhatsApp Cloud API`
- `test: adiciona testes para CPF Handler`
- `docs: atualiza documentação de configuração`

### 2. Código

- Use TypeScript com tipos explícitos (evitar `any`)
- Nomes em **camelCase** para variáveis/funções
- Nomes em **PascalCase** para classes/interfaces
- Use **async/await** ao invés de `Promise.then()`
- Sempre tratar erros com **try/catch**

### 3. Testes

- Adicione testes para novas funcionalidades
- Mantenha cobertura adequada (objetivo: >80%)
- Testes devem ser isolados e independentes
- Use mocks para dependências externas

### 4. Segurança

- **Nunca** logar dados sensíveis
- **Sempre** usar sanitização/masking para CPFs
- **Nunca** commitar secrets ou variáveis de ambiente
- **Sempre** validar inputs do usuário

### 5. Logs

- Use níveis apropriados (`info`, `warn`, `error`)
- Inclua contexto relevante (requestId, userId mascarado)
- **Nunca** logar CPFs completos

## Estrutura de Testes

### Testes Unitários

Testam componentes isoladamente, usando mocks para dependências.

**Localização**: `tests/unit/`

**Exemplos**:
- Validação de CPF
- Hash de CPF com pepper
- Sanitização de logs
- Lógica de negócio

### Testes de Integração

Testam integração entre componentes ou com APIs externas (mocks).

**Localização**: `tests/integration/`

**Exemplos**:
- Health check endpoint
- DevTools Flow Tester
- Integração entre camadas

## Referências

- [Configuração](CONFIGURATION.md) - Variáveis de ambiente e configurações
- [Arquitetura](ARCHITECTURE.md) - Estrutura e princípios de design
- [API Integrations](API_INTEGRATIONS.md) - Detalhes das integrações
