export interface Boleto {
  id: string;
  numeroDocumento: string;
  nossoNumero: string;
  valor: number;
  vencimento: Date;
  cpfHash: string; // SHA256 + pepper do CPF
  pdfUrl?: string;
  pdfDriveId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoletoSicoob {
  nossoNumero: string;
  numeroDocumento: string;
  valor: number;
  vencimento: string;
  situacao: string;
  pdf?: Buffer;
}

export interface BoletoBradesco {
  nossoNumero: string;
  numeroDocumento: string;
  valor: number;
  vencimento: string;
  situacao: string;
  pdf?: Buffer;
  bank?: 'BRADESCO'; // Identificador do banco de origem
}

/**
 * Parâmetros para consulta de boleto via GET /boletos
 * Pelo menos um dos identificadores deve ser fornecido: nossoNumero, linhaDigitavel ou codigoBarras
 */
export interface ConsultaBoletoParams {
  nossoNumero?: number;
  linhaDigitavel?: string;
  codigoBarras?: string;
}

/**
 * Parâmetros opcionais para busca de boletos por CPF via GET /pagadores/{cpf}/boletos
 */
export interface BuscarBoletosPorCPFParams {
  codigoSituacao?: number; // 1: Entrada Normal, 2: Baixado, 3: Liquidado
  dataInicio?: string; // Data de Vencimento Inicial (formato: yyyy-MM-dd)
  dataFim?: string; // Data de Vencimento Final (formato: yyyy-MM-dd)
}

/**
 * Resposta completa do endpoint GET /boletos do Sicoob
 * Mapeia todos os campos retornados pela API conforme especificação
 */
export interface SicoobBoletoCompleto {
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