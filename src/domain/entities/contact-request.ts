import { RequestStatus } from '../enums/request-status.js';

/**
 * Entidade: Solicitação de Contato
 * 
 * from: ID do WhatsApp do usuário
 */
export interface ContactRequest {
  id: string;
  from: string; // ID do WhatsApp (whatsappId)
  message: string; // Mensagem do usuário
  createdAt: Date;
  status: RequestStatus;
}
