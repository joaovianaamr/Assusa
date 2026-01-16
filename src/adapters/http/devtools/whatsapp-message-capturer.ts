import { WhatsAppPort, WhatsAppResponse } from '../../../application/ports/driven/whatsapp-port.js';

/**
 * Mensagem capturada pelo DevTools
 */
export interface CapturedMessage {
  type: 'text' | 'document';
  to: string;
  content: string;
  filename?: string;
  caption?: string;
  timestamp: Date;
}

/**
 * Wrapper do WhatsAppPort que captura mensagens enviadas
 * Usado pelo DevTools para exibir mensagens de saída
 */
export class WhatsAppMessageCapturer implements WhatsAppPort {
  private capturedMessages: CapturedMessage[] = [];

  constructor(private whatsappAdapter: WhatsAppPort) {}

  /**
   * Limpa mensagens capturadas
   */
  clearCaptured(): void {
    this.capturedMessages = [];
  }

  /**
   * Retorna mensagens capturadas
   */
  getCaptured(): CapturedMessage[] {
    return [...this.capturedMessages];
  }

  async sendText(to: string, text: string, _requestId: string): Promise<WhatsAppResponse> {
    // Capturar mensagem
    this.capturedMessages.push({
      type: 'text',
      to,
      content: text,
      timestamp: new Date(),
    });

    // Chamar adapter original (em modo dev, pode não enviar realmente)
    // Por enquanto, vamos simular sucesso para DevTools
    return {
      success: true,
      messageId: `devtools_${Date.now()}`,
    };
  }

  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    _requestId: string
  ): Promise<string> {
    // Capturar upload
    this.capturedMessages.push({
      type: 'document',
      to: '', // Será preenchido no sendDocument
      content: `[Mídia: ${filename}, ${mimeType}, ${buffer.length} bytes]`,
      filename,
      timestamp: new Date(),
    });

    // Retornar ID fictício para DevTools
    return `devtools_media_${Date.now()}`;
  }

  async sendDocument(
    to: string,
    _mediaId: string,
    filename: string,
    caption: string | undefined,
    _requestId: string
  ): Promise<WhatsAppResponse> {
    // Atualizar última mensagem capturada com 'to' e caption
    const lastMessage = this.capturedMessages[this.capturedMessages.length - 1];
    if (lastMessage && lastMessage.type === 'document') {
      lastMessage.to = to;
      lastMessage.caption = caption;
    } else {
      // Se não havia mensagem anterior, criar nova
      this.capturedMessages.push({
        type: 'document',
        to,
        content: `[Documento: ${filename}]`,
        filename,
        caption,
        timestamp: new Date(),
      });
    }

    return {
      success: true,
      messageId: `devtools_${Date.now()}`,
    };
  }

  async handleWebhook(payload: unknown, requestId: string): Promise<import('../../../application/ports/driven/whatsapp-port.js').WhatsAppMessage | null> {
    return this.whatsappAdapter.handleWebhook(payload, requestId);
  }

  validateWebhook(mode: string, token: string, challenge: string): string | null {
    return this.whatsappAdapter.validateWebhook(mode, token, challenge);
  }

  validateSignature(payload: string, signature: string, requestId: string): boolean {
    return this.whatsappAdapter.validateSignature(payload, signature, requestId);
  }
}
