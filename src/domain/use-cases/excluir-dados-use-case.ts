import { WhatsAppPort } from '../ports/whatsapp-port.js';
import { SheetsPort } from '../ports/sheets-port.js';
import { DrivePort } from '../ports/drive-port.js';
import { StoragePort } from '../ports/storage-port.js';
import { Logger } from '../ports/logger-port.js';

export interface ExcluirDadosInput {
  whatsappId: string;
  cpfHash: string;
  cpfMasked: string;
  requestId: string;
}

export interface ExcluirDadosOutput {
  success: boolean;
  deletedCount?: number;
  errorMessage?: string;
}

export class ExcluirDadosUseCase {
  constructor(
    private whatsapp: WhatsAppPort,
    private sheets: SheetsPort,
    private drive: DrivePort,
    private storage: StoragePort,
    private logger: Logger
  ) {}

  async execute(input: ExcluirDadosInput): Promise<ExcluirDadosOutput> {
    const { whatsappId, cpfHash, cpfMasked, requestId } = input;

    try {
      this.logger.info({ requestId, whatsappId, cpfMasked }, 'Iniciando exclusão de dados');

      // Buscar todas as requisições do CPF
      const requests = await this.sheets.findRequestsByCpfHash(cpfHash, requestId);

      // Deletar arquivos do Drive
      let deletedFiles = 0;
      for (const req of requests) {
        if (req.boletoId && req.status === 'SUCCESS') {
          try {
            await this.drive.deleteFile(req.boletoId, requestId);
            deletedFiles++;
          } catch (error) {
            this.logger.warn({ requestId, boletoId: req.boletoId, error }, 'Erro ao deletar arquivo do Drive');
          }
        }
      }

      // Deletar registros do Sheets
      await this.sheets.deleteRequestsByCpfHash(cpfHash, requestId);

      // Deletar dados do cache/Redis
      const cacheKey = `user:${cpfHash}`;
      await this.storage.delete(cacheKey, requestId);

      // Registrar exclusão no Sheets (mantém histórico de exclusão, mas sem dados sensíveis)
      await this.sheets.logRequest({
        id: crypto.randomUUID(),
        whatsappId,
        cpfHash: cpfHash.substring(0, 8) + '***', // Hash truncado para não ser possível reconstruir
        cpfMasked: '***.***.***-**',
        action: 'EXCLUIR_DADOS',
        status: 'SUCCESS',
        createdAt: new Date(),
        requestId,
      }, requestId);

      await this.whatsapp.sendTextMessage(
        whatsappId,
        `✅ Seus dados foram excluídos com sucesso!\n\n${deletedFiles} arquivo(s) removido(s) do sistema.\n\nConforme a LGPD, todos os seus dados pessoais foram permanentemente deletados.`,
        requestId
      );

      this.logger.info({ requestId, cpfMasked, deletedFiles }, 'Dados excluídos com sucesso');

      return { success: true, deletedCount: deletedFiles };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir dados';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao excluir dados');

      await this.whatsapp.sendTextMessage(
        whatsappId,
        '❌ Ocorreu um erro ao excluir seus dados. Por favor, tente novamente ou entre em contato conosco.',
        requestId
      );

      return { success: false, errorMessage };
    }
  }
}
