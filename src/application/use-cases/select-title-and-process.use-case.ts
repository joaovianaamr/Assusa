import { ConversationStateStore } from '../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../application/ports/driven/whatsapp-port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Title } from '../../domain/entities/title.js';
import { GenerateSecondCopyUseCase } from './generate-second-copy.use-case.js';

/**
 * Use Case: Selecionar título e processar
 * - Valida índice, pega title selecionado do estado, chama GenerateSecondCopy
 */
export class SelectTitleAndProcessUseCase {
  constructor(
    private conversationState: ConversationStateStore,
    private whatsapp: WhatsAppPort,
    private generateSecondCopy: GenerateSecondCopyUseCase,
    private logger: Logger
  ) {}

  async execute(from: string, selectionIndex: number, requestId: string): Promise<void> {
    // Obter estado atual
    const state = await this.conversationState.get(from);

    if (!state || state.step !== 'WAITING_SELECTION') {
      await this.whatsapp.sendTextMessage(
        from,
        '❌ Erro: Estado da conversa inválido. Por favor, inicie novamente o fluxo de segunda via.',
        requestId
      );
      return;
    }

    const titles = state.data.titles as Array<{
      id: string;
      nossoNumero: string;
      valor?: number;
      vencimento?: string;
    }>;

    if (!titles || !Array.isArray(titles)) {
      await this.whatsapp.sendTextMessage(
        from,
        '❌ Erro: Dados de títulos não encontrados. Por favor, inicie novamente o fluxo.',
        requestId
      );
      await this.conversationState.clear(from);
      return;
    }

    // Validar índice (1-based para o usuário, 0-based internamente)
    const index = selectionIndex - 1;
    if (index < 0 || index >= titles.length) {
      await this.whatsapp.sendTextMessage(
        from,
        `❌ Opção inválida. Por favor, escolha um número entre 1 e ${titles.length}:`,
        requestId
      );
      return;
    }

    const selectedTitleData = titles[index];
    const cpfHash = state.data.cpfHash as string;
    const cpfMasked = state.data.cpfMasked as string;

    // Reconstruir objeto Title
    const selectedTitle: Title = {
      id: selectedTitleData.id,
      nossoNumero: selectedTitleData.nossoNumero,
      valor: selectedTitleData.valor,
      vencimento: selectedTitleData.vencimento ? new Date(selectedTitleData.vencimento) : undefined,
    };

    this.logger.info({ 
      requestId, 
      from, 
      cpfMasked, 
      nossoNumero: selectedTitle.nossoNumero 
    }, 'Título selecionado para processamento');

    // Processar geração de segunda via
    await this.generateSecondCopy.execute(from, cpfHash, cpfMasked, selectedTitle, requestId);

    // Limpar estado após processamento
    await this.conversationState.clear(from);
  }
}
