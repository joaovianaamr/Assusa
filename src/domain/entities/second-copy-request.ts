import { RequestStatus } from '../enums/request-status.js';

/**
 * Entidade: Solicitação de 2ª Via de Boleto
 * 
 * Regras:
 * - CPF puro nunca deve ser persistido (usar cpfHash e cpfMasked)
 * - from: ID do WhatsApp do usuário
 */
export interface SecondCopyRequest {
  id: string;
  from: string; // ID do WhatsApp (whatsappId)
  cpfHash: string; // SHA256 hex do CPF limpo com pepper
  cpfMasked: string; // CPF mascarado no formato ***.***.***-XX
  createdAt: Date;
  status: RequestStatus;
  errorCode?: string;
  bank: 'SICOOB';
  driveFileId?: string; // ID do arquivo PDF no Google Drive
}
