# Revisão: Implementação API Sicoob - Consulta de Boletos

## 📋 Resumo Executivo

A especificação em `implementacao_boletos_sicoob.txt` descreve o endpoint **`GET /boletos`** para consulta de boletos bancários, que **não está implementado** no código atual. O sistema atualmente usa endpoints diferentes (`/boletos/segunda-via` e `/pagadores/{cpf}/boletos`).

## 🔍 Análise Comparativa

### Endpoint Especificado vs Implementado

| Aspecto | Especificação (`implementacao_boletos_sicoob.txt`) | Implementação Atual |
|--------|---------------------------------------------------|---------------------|
| **Endpoint** | `GET /boletos` | `GET /boletos/segunda-via` e `GET /pagadores/{cpf}/boletos` |
| **Base URL** | `https://api.sicoob.com.br/cobranca-bancaria/v3` | ✅ Configurado corretamente |
| **Parâmetros Obrigatórios** | `numeroCliente`, `codigoModalidade` | ✅ Usados em `/boletos/segunda-via` |
| **Parâmetros Opcionais** | `nossoNumero`, `linhaDigitavel`, `codigoBarras`, `numeroContratoCobranca` | ✅ `nossoNumero` e `numeroContratoCobranca` usados |
| **Estrutura de Resposta** | Completa (pagador, beneficiarioFinal, mensagensInstrucao, listaHistorico, rateioCreditos, qrCode, etc.) | Parcial (apenas campos básicos) |

### Parâmetros do Endpoint `/boletos`

#### ✅ Já Configurados
- `numeroCliente` → `config.sicoobNumeroCliente`
- `codigoModalidade` → `config.sicoobCodigoModalidade`
- `numeroContratoCobranca` → `config.sicoobNumeroContratoCobranca` (opcional)

#### ❌ Não Implementados como Parâmetros de Query
- `nossoNumero` (integer) - usado apenas em `/boletos/segunda-via`
- `linhaDigitavel` (string, 47 posições)
- `codigoBarras` (string, 44 posições)

### Estrutura de Resposta

#### ✅ Campos Já Mapeados (parcialmente)
- `nossoNumero`
- `valor`
- `dataVencimento`
- `codigoBarras`
- `linhaDigitavel`
- `situacaoBoleto` (como `situacao`)

#### ❌ Campos Não Mapeados
- `numeroCliente`
- `codigoModalidade`
- `numeroContaCorrente`
- `codigoEspecieDocumento`
- `dataEmissao`
- `seuNumero`
- `identificacaoBoletoEmpresa`
- `identificacaoEmissaoBoleto`
- `identificacaoDistribuicaoBoleto`
- `dataLimitePagamento`
- `valorAbatimento`
- `tipoDesconto`
- `dataPrimeiroDesconto` / `valorPrimeiroDesconto`
- `dataSegundoDesconto` / `valorSegundoDesconto`
- `dataTerceiroDesconto` / `valorTerceiroDesconto`
- `tipoMulta` / `dataMulta` / `valorMulta`
- `tipoJurosMora` / `dataJurosMora` / `valorJurosMora`
- `numeroParcela`
- `aceite`
- `numeroDiasNegativacao`
- `numeroDiasProtesto`
- `quantidadeDiasFloat`
- `pagador` (objeto completo com CPF/CNPJ, nome, endereço, etc.)
- `beneficiarioFinal` (objeto com CPF/CNPJ e nome)
- `mensagensInstrucao` (array de strings)
- `listaHistorico` (array de objetos)
- `rateioCreditos` (array de objetos)
- `qrCode` (string PIX)

## 🎯 Recomendações

### 1. Implementar Endpoint `GET /boletos`

**Prioridade: ALTA**

O endpoint `GET /boletos` conforme especificado deve ser implementado para:
- Consulta completa de boletos usando múltiplos identificadores (nossoNumero, linhaDigitavel, codigoBarras)
- Obter informações completas do boleto (pagador, beneficiário, histórico, rateio, QR Code PIX)

**Localização sugerida**: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`

**Método sugerido**:
```typescript
async consultarBoleto(params: {
  nossoNumero?: number;
  linhaDigitavel?: string;
  codigoBarras?: string;
}): Promise<SicoobBoletoCompleto | null>
```

### 2. Criar Interface para Resposta Completa

**Prioridade: ALTA**

Criar interface TypeScript que mapeie todos os campos da resposta conforme especificação:

```typescript
interface SicoobBoletoCompleto {
  numeroCliente: number;
  codigoModalidade: number;
  numeroContaCorrente: number;
  codigoEspecieDocumento: string;
  dataEmissao: string;
  nossoNumero: number;
  seuNumero: string;
  identificacaoBoletoEmpresa: string;
  codigoBarras: string;
  linhaDigitavel: string;
  identificacaoEmissaoBoleto: number;
  identificacaoDistribuicaoBoleto: number;
  valor: number;
  dataVencimento: string;
  dataLimitePagamento: string;
  valorAbatimento: number;
  tipoDesconto: number;
  dataPrimeiroDesconto: string;
  valorPrimeiroDesconto: number;
  dataSegundoDesconto: string;
  valorSegundoDesconto: number;
  dataTerceiroDesconto: string;
  valorTerceiroDesconto: number;
  tipoMulta: number;
  dataMulta: string;
  valorMulta: number;
  tipoJurosMora: number;
  dataJurosMora: string;
  valorJurosMora: number;
  numeroParcela: number;
  aceite: boolean;
  numeroDiasNegativacao: number;
  numeroDiasProtesto: number;
  quantidadeDiasFloat: number;
  pagador: {
    numeroCpfCnpj: string;
    nome: string;
    endereco: string;
    bairro: string;
    cidade: string;
    cep: string;
    uf: string;
    email: string;
  };
  beneficiarioFinal?: {
    numeroCpfCnpj: string;
    nome: string;
  };
  mensagensInstrucao: string[];
  listaHistorico: Array<{
    dataHistorico: string;
    tipoHistorico: string;
    descricaoHistorico: string;
  }>;
  situacaoBoleto: string;
  rateioCreditos?: Array<{
    numeroBanco: number;
    numeroAgencia: number;
    numeroContaCorrente: string;
    contaPrincipal: boolean;
    codigoTipoValorRateio: number;
    valorRateio: string;
    codigoTipoCalculoRateio: number;
    numeroCpfCnpjTitular: string;
    nomeTitular: string;
    codigoFinalidadeTed: string;
    codigoTipoContaDestinoTed: string;
    quantidadeDiasFloat: number;
    dataFloatCredito: string;
  }>;
  qrCode?: string;
  numeroContratoCobranca: number;
}
```

### 3. Adicionar ao SicoobPort

**Prioridade: MÉDIA**

Adicionar método ao port para consulta completa:

```typescript
export interface SicoobPort {
  buscarBoletosPorCPF(cpf: string, requestId: string): Promise<BoletoSicoob[]>;
  gerarSegundaVia(nossoNumero: string, cpfHash: string, requestId: string): Promise<Buffer>;
  consultarBoleto(params: ConsultaBoletoParams, requestId: string): Promise<SicoobBoletoCompleto | null>; // NOVO
}
```

### 4. Validação de Parâmetros

**Prioridade: MÉDIA**

Implementar validação para garantir que:
- Pelo menos um dos três identificadores seja fornecido: `nossoNumero`, `linhaDigitavel` ou `codigoBarras`
- `linhaDigitavel` tenha exatamente 47 caracteres
- `codigoBarras` tenha exatamente 44 caracteres
- `numeroCliente` e `codigoModalidade` sejam sempre fornecidos (já configurados globalmente)

### 5. Tratamento de Erros

**Prioridade: BAIXA** (já implementado)

O tratamento de erros atual já cobre:
- ✅ 200: Sucesso
- ✅ 204: Sem conteúdo
- ✅ 400: Erros de negócio
- ✅ 406: Inconsistência nos dados
- ✅ 500: Erro interno

### 6. LGPD e Segurança

**Prioridade: ALTA** (já implementado)

✅ O código atual já segue as regras LGPD:
- CPFs nunca aparecem em logs (usar mascaramento)
- Payloads brutos não são logados
- Dados sensíveis são tratados adequadamente

**Atenção**: Ao implementar o novo endpoint, garantir que:
- CPF/CNPJ do `pagador` e `beneficiarioFinal` sejam mascarados em logs
- Endereços e emails não sejam logados completos

## 📝 Checklist de Implementação

### Fase 1: Estrutura Base
- [ ] Criar interface `SicoobBoletoCompleto` com todos os campos
- [ ] Criar interface `ConsultaBoletoParams` para parâmetros
- [ ] Adicionar método `consultarBoleto()` ao `SicoobPort`
- [ ] Implementar validação de parâmetros

### Fase 2: Implementação do Adapter
- [ ] Implementar método `consultarBoleto()` em `SicoobBankProviderAdapter`
- [ ] Montar query params corretamente (numeroCliente, codigoModalidade, nossoNumero/linhaDigitavel/codigoBarras)
- [ ] Mapear resposta completa da API
- [ ] Tratar erros 200, 204, 400, 406, 500

### Fase 3: Testes
- [ ] Teste unitário: consulta por nossoNumero
- [ ] Teste unitário: consulta por linhaDigitavel
- [ ] Teste unitário: consulta por codigoBarras
- [ ] Teste unitário: validação de parâmetros (erro quando nenhum identificador fornecido)
- [ ] Teste unitário: tratamento de erro 404 (retorna null)
- [ ] Teste unitário: tratamento de erro 400/406/500 (lança SicoobError)
- [ ] Teste de integração: consulta real com credenciais válidas

### Fase 4: Documentação
- [ ] Atualizar `docs/SICOOB.md` com novo endpoint
- [ ] Adicionar exemplos de uso
- [ ] Documentar campos da resposta

## 🔗 Referências

- Especificação: `implementacao_boletos_sicoob.txt`
- Código atual: `src/adapters/sicoob/sicoob-bank-provider-adapter.ts`
- Port: `src/application/ports/driven/sicoob-port.ts`
- Config: `src/infrastructure/config/config.ts`

## ⚠️ Observações Importantes

1. **Endpoint Diferente**: O endpoint `/boletos` é diferente de `/boletos/segunda-via`. Ambos podem coexistir:
   - `/boletos` → Consulta completa de boleto
   - `/boletos/segunda-via` → Geração de PDF da segunda via

2. **Modalidades**: A especificação lista modalidades (1, 3, 4, 5, 8). Verificar se `codigoModalidade` configurado corresponde a uma dessas.

3. **Base URL**: A base URL já está configurada corretamente como `https://api.sicoob.com.br/cobranca-bancaria/v3`.

4. **QR Code PIX**: O campo `qrCode` na resposta pode ser útil para pagamentos via PIX. Considerar expor isso em algum use case futuro.

5. **Histórico e Rateio**: Os campos `listaHistorico` e `rateioCreditos` podem ser úteis para auditoria e relatórios, mas podem não ser necessários para o fluxo atual de segunda via.
