import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { EventType } from '../../domain/enums/event-type.js';
import { CpfHandler } from '../../infrastructure/security/cpf-handler.js';

/**
 * Use Case: Receber mensagem do fluxo "Fale com a gente"
 * - Sanitiza mensagem antes de salvar (limita tamanho e remove PII óbvia)
 * - Registra no Sheets com event_type=CONTACT_REQUEST
 * - Inclui metadados úteis (from, channel=whatsapp, createdAt, status=RECEIVED)
 * - Responde confirmando prazo de retorno
 */
export class ReceiveTalkToUsMessageUseCase {
  private static readonly MAX_MESSAGE_LENGTH = 500;

  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(from: string, message: string, requestId: string): Promise<void> {
    // Validar tamanho da mensagem
    if (message.length > ReceiveTalkToUsMessageUseCase.MAX_MESSAGE_LENGTH) {
      await this.whatsapp.sendText(
        from,
        '❌ Mensagem muito longa. Por favor, envie uma mensagem com no máximo 500 caracteres:',
        requestId
      );
      return;
    }

    // Sanitizar mensagem antes de salvar (remove/mascara PII óbvia)
    const sanitizedMessage = this.sanitizeMessage(message);

    // Registrar no Sheets com metadados
    const createdAt = new Date().toISOString();
    await this.sheetLogger.appendEvent(EventType.CONTACT_REQUEST, {
      from,
      message: sanitizedMessage,
      channel: 'whatsapp',
      status: 'RECEIVED',
      requestId,
      timestamp: createdAt,
      createdAt,
    });

    // Enviar confirmação com prazo de retorno
    const confirmationText = `✅ Mensagem recebida com sucesso!\n\n` +
      `Respondemos em horário comercial.\n\n` +
      `Obrigado por entrar em contato conosco!`;

    await this.whatsapp.sendText(from, confirmationText, requestId);

    // Limpar estado
    await this.conversationState.clear(from);

    this.logger.info({ requestId, from, messageLength: message.length }, 'Mensagem de contato registrada');
  }

  /**
   * Sanitiza mensagem removendo/mascarando PII óbvia
   * - Limita tamanho
   * - Mascara CPF válido encontrado na mensagem
   * - Usa a mesma lógica de sanitizeForLogs (maskCpfInString)
   */
  private sanitizeMessage(message: string): string {
    // Limitar tamanho
    const truncated = message.substring(0, ReceiveTalkToUsMessageUseCase.MAX_MESSAGE_LENGTH);

    // Sanitizar mensagem: mascarar CPF válido
    // Usa a mesma lógica interna de sanitizeForLogs (maskCpfInString)
    return this.maskCpfInString(truncated);
  }

  /**
   * Mascara CPF válido encontrado em string
   * Mesma lógica usada em sanitizeForLogs
   */
  private maskCpfInString(str: string): string {
    // Padrão para detectar CPF formatado: XXX.XXX.XXX-XX
    const formattedPattern = /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g;
    let result = str.replace(formattedPattern, (match) => {
      const normalized = CpfHandler.normalizeCpf(match);
      // Valida CPF antes de mascarar
      if (CpfHandler.isValidCpf(normalized)) {
        const lastTwo = normalized.substring(9, 11);
        return `***.***.***-${lastTwo}`;
      }
      return match; // Mantém original se CPF inválido
    });

    // Padrão para detectar CPF sem formatação: 11 dígitos seguidos
    const unformattedPattern = /\b(\d{11})\b/g;
    result = result.replace(unformattedPattern, (match) => {
      // Valida CPF antes de mascarar
      if (CpfHandler.isValidCpf(match)) {
        const lastTwo = match.substring(9, 11);
        return `***.***.***-${lastTwo}`;
      }
      return match; // Mantém original se CPF inválido
    });

    return result;
  }
}
