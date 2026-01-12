import { PdfService } from '../../application/ports/driven/pdf-service.port.js';
import { PdfBuildFromBankPdfParams, PdfBuildFromDataParams } from '../../application/dtos/pdf-build-params.dto.js';
import { Logger } from '../../application/ports/driven/logger-port.js';

/**
 * Adapter: Serviço de PDF simples
 * 
 * Para buildFromBankPdf: retorna o buffer como está (sem processamento)
 * Para buildFromData: cria um PDF básico usando biblioteca de PDF
 * 
 * NOTA: Esta é uma implementação simplificada. Em produção, usar biblioteca apropriada
 * como pdfkit, pdf-lib, ou similar para gerar PDFs a partir de dados.
 */
export class SimplePdfServiceAdapter implements PdfService {
  constructor(private logger: Logger) {}

  async buildFromBankPdf(params: PdfBuildFromBankPdfParams): Promise<Buffer> {
    try {
      // Por enquanto, retornar o buffer do PDF do banco como está
      // Em produção, pode ser necessário processar/validar o PDF
      this.logger.debug({ filename: params.filename }, 'PDF processado (buffer original)');
      
      return params.bankPdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar PDF';
      this.logger.error({ error: errorMessage }, 'Erro ao processar PDF do banco');
      throw new Error(`Falha ao processar PDF: ${errorMessage}`);
    }
  }

  async buildFromData(params: PdfBuildFromDataParams): Promise<Buffer> {
    try {
      // Por enquanto, retornar um buffer vazio
      // Em produção, usar biblioteca de PDF para gerar PDF a partir dos dados
      this.logger.debug({ filename: params.filename }, 'PDF gerado a partir de dados (placeholder)');
      
      // TODO: Implementar geração de PDF usando pdfkit, pdf-lib ou similar
      // Por enquanto, retornar buffer vazio como placeholder
      return Buffer.from('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar PDF';
      this.logger.error({ error: errorMessage }, 'Erro ao gerar PDF a partir de dados');
      throw new Error(`Falha ao gerar PDF: ${errorMessage}`);
    }
  }
}
