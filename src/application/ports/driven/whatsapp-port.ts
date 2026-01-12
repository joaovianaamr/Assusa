export interface WhatsAppMessage {
  from: string; // WhatsApp ID
  message: string;
  messageId: string;
  timestamp: number;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppPort {
  sendText(to: string, text: string, requestId: string): Promise<WhatsAppResponse>;
  uploadMedia(buffer: Buffer, mimeType: string, filename: string, requestId: string): Promise<string>;
  sendDocument(to: string, mediaId: string, filename: string, caption: string | undefined, requestId: string): Promise<WhatsAppResponse>;
  handleWebhook(payload: unknown, requestId: string): Promise<WhatsAppMessage | null>;
  validateWebhook(mode: string, token: string, challenge: string): string | null;
  validateSignature(payload: string, signature: string, requestId: string): boolean;
}
