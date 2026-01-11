/**
 * DTO: Resultado da obtenção de dados do banco
 */
export interface BankDataResult {
  linhaDigitavel: string;
  valor: number;
  vencimento: Date;
  nossoNumero: string;
  beneficiario?: string;
  pagador?: string;
  [key: string]: unknown; // Permite campos adicionais específicos do banco
}
