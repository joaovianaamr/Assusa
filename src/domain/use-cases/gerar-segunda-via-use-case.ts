import { WhatsAppPort } from '../ports/whatsapp-port.js';
import { SicoobPort } from '../ports/sicoob-port.js';
import { DrivePort } from '../ports/drive-port.js';
import { SheetsPort } from '../ports/sheets-port.js';
import { Logger } from '../ports/logger-port.js';

export interface GerarSegundaViaInput {
  whatsappId: string;
  cpfHash: string;
  cpfMasked: string;
  nossoNumero?: string;
  requestId: string;
}

export interface GerarSegundaViaOutput {
  success: boolean;
  pdfUrl?: string;
  errorMessage?: string;
}

export class GerarSegundaViaUseCase {
  constructor(
    private whatsapp: WhatsAppPort,
    private sicoob: SicoobPort,
    private drive: DrivePort,
    private sheets: SheetsPort,
    private logger: Logger
  ) {}

  async execute(input: GerarSegundaViaInput): Promise<GerarSegundaViaOutput> {
    const { whatsappId, cpfHash, cpfMasked, nossoNumero, requestId } = input;

    try {
      this.logger.info({ requestId, whatsappId, cpfMasked }, 'Iniciando geração de 2ª via');

      // Buscar boletos do Sicoob
      let boletos;
      try {
        boletos = await this.sicoob.buscarBoletosPorCPF(cpfHash, requestId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar boletos';
        this.logger.error({ requestId, error: errorMessage }, 'Erro ao buscar boletos no Sicoob');
        
        await this.sheets.logRequest({
          id: crypto.randomUUID(),
          whatsappId,
          cpfHash,
          cpfMasked,
          action: 'GERAR_2VIA',
          status: 'ERROR',
          errorMessage,
          createdAt: new Date(),
          requestId,
        }, requestId);

        await this.whatsapp.sendTextMessage(
          whatsappId,
          '❌ Desculpe, ocorreu um erro ao buscar seus boletos. Por favor, tente novamente mais tarde ou entre em contato conosco.',
          requestId
        );

        return { success: false, errorMessage };
      }

      if (!boletos || boletos.length === 0) {
        const errorMessage = 'Nenhum boleto encontrado para este CPF';
        this.logger.info({ requestId, cpfMasked }, errorMessage);

        await this.sheets.logRequest({
          id: crypto.randomUUID(),
          whatsappId,
          cpfHash,
          cpfMasked,
          action: 'GERAR_2VIA',
          status: 'ERROR',
          errorMessage,
          createdAt: new Date(),
          requestId,
        }, requestId);

        await this.whatsapp.sendTextMessage(
          whatsappId,
          '❌ Nenhum boleto encontrado para este CPF. Verifique o CPF informado e tente novamente.',
          requestId
        );

        return { success: false, errorMessage };
      }

      // Se nossoNumero foi fornecido, buscar boleto específico
      let boleto = boletos[0];
      if (nossoNumero) {
        boleto = boletos.find(b => b.nossoNumero === nossoNumero) || boletos[0];
      }

      // Gerar PDF da 2ª via
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.sicoob.gerarSegundaVia(boleto.nossoNumero, cpfHash, requestId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar 2ª via';
        this.logger.error({ requestId, nossoNumero: boleto.nossoNumero, error: errorMessage }, 'Erro ao gerar PDF');

        await this.sheets.logRequest({
          id: crypto.randomUUID(),
          whatsappId,
          cpfHash,
          cpfMasked,
          action: 'GERAR_2VIA',
          status: 'ERROR',
          errorMessage,
          createdAt: new Date(),
          requestId,
        }, requestId);

        await this.whatsapp.sendTextMessage(
          whatsappId,
          '❌ Erro ao gerar a 2ª via do boleto. Por favor, tente novamente ou entre em contato conosco.',
          requestId
        );

        return { success: false, errorMessage };
      }

      // Upload para Google Drive
      const fileName = `boleto-${boleto.nossoNumero}-${Date.now()}.pdf`;
      let driveFileId: string;
      try {
        driveFileId = await this.drive.uploadFile(fileName, pdfBuffer, 'application/pdf', requestId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar PDF no Drive';
        this.logger.error({ requestId, error: errorMessage }, 'Erro ao fazer upload para Drive');

        await this.sheets.logRequest({
          id: crypto.randomUUID(),
          whatsappId,
          cpfHash,
          cpfMasked,
          action: 'GERAR_2VIA',
          status: 'ERROR',
          errorMessage,
          createdAt: new Date(),
          requestId,
        }, requestId);

        await this.whatsapp.sendTextMessage(
          whatsappId,
          '❌ Erro ao processar o PDF. Por favor, tente novamente.',
          requestId
        );

        return { success: false, errorMessage };
      }

      const pdfUrl = this.drive.getFileUrl(driveFileId);

      // Registrar no Sheets
      await this.sheets.logRequest({
        id: crypto.randomUUID(),
        whatsappId,
        cpfHash,
        cpfMasked,
        action: 'GERAR_2VIA',
        status: 'SUCCESS',
        boletoId: driveFileId,
        createdAt: new Date(),
        requestId,
      }, requestId);

      // Enviar PDF via WhatsApp
      await this.whatsapp.sendDocumentMessage(
        whatsappId,
        pdfUrl,
        `Boleto-${boleto.numeroDocumento}.pdf`,
        requestId
      );

      await this.whatsapp.sendTextMessage(
        whatsappId,
        '✅ Segunda via do boleto gerada com sucesso! Você receberá o PDF em instantes.',
        requestId
      );

      this.logger.info({ requestId, cpfMasked, nossoNumero: boleto.nossoNumero }, '2ª via gerada com sucesso');

      return { success: true, pdfUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado';
      this.logger.error({ requestId, error: errorMessage }, 'Erro inesperado ao gerar 2ª via');

      await this.sheets.logRequest({
        id: crypto.randomUUID(),
        whatsappId,
        cpfHash,
        cpfMasked,
        action: 'GERAR_2VIA',
        status: 'ERROR',
        errorMessage,
        createdAt: new Date(),
        requestId,
      }, requestId);

      await this.whatsapp.sendTextMessage(
        whatsappId,
        '❌ Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato conosco.',
        requestId
      );

      return { success: false, errorMessage };
    }
  }
}
