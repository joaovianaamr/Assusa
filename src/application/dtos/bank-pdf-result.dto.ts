/**
 * DTO: Resultado da obtenção de PDF do banco
 */
export interface BankPdfResult {
  buffer: Buffer;
  mime: string;
  filename?: string;
}
