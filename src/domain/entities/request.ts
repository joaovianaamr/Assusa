export interface RequestLog {
  id: string;
  whatsappId: string; // ID do WhatsApp do usuário
  cpfHash: string; // SHA256 + pepper do CPF
  cpfMasked: string; // CPF mascarado (XXX.XXX.XXX-XX)
  action: RequestAction;
  status: RequestStatus;
  boletoId?: string;
  errorMessage?: string;
  createdAt: Date;
  requestId: string; // Para correlação de logs
}

export type RequestAction = 'GERAR_2VIA' | 'FALE_CONOSCO' | 'ACESSAR_SITE' | 'EXCLUIR_DADOS';
export type RequestStatus = 'SUCCESS' | 'ERROR' | 'PENDING';
