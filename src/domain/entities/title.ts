/**
 * Modelo de título interno
 * Representa um título bancário no sistema
 */
export interface Title {
  id: string;
  nossoNumero: string;
  contrato?: string;
  codigoBeneficiario?: string;
  valor?: number;
  vencimento?: Date;
  status?: string; // Status do título (ex: "Aberto", "Liquidado", "Cancelado", etc.)
  bank?: 'SICOOB' | 'BRADESCO'; // Banco de origem (opcional para compatibilidade)
}
