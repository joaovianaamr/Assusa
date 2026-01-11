import { BankDataResult } from './bank-data-result.dto.js';

/**
 * DTO: Parâmetros para construção de PDF a partir de PDF do banco
 */
export interface PdfBuildFromBankPdfParams {
  bankPdfBuffer: Buffer;
  filename?: string;
}

/**
 * DTO: Parâmetros para construção de PDF a partir de dados
 */
export interface PdfBuildFromDataParams {
  data: BankDataResult;
  filename?: string;
}
