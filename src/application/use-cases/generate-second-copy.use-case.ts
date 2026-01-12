import { BankProvider } from '../../application/ports/driven/bank-provider.port.js';
import { PdfService } from '../../application/ports/driven/pdf-service.port.js';
import { DriveStorage } from '../../application/ports/driven/drive-storage.port.js';
import { SheetLogger } from '../../application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { Title } from '../../domain/entities/title.js';
import { EventType } from '../../domain/enums/event-type.js';
import { PdfBuildFromBankPdfParams } from '../../application/dtos/pdf-build-params.dto.js';
import { PdfBuildFromDataParams } from '../../application/dtos/pdf-build-params.dto.js';

/**
 * Resultado da geração de segunda via
 */
export interface GenerateSecondCopyResult {
  buffer?: Buffer; // Opcional - para enviar via WhatsApp
  driveFileId: string;
  filename: string;
}

/**
 * Use Case: Gerar segunda via
 * - Chama BankProvider (Sicoob) p/ obter PDF; se não tiver PDF, pega dados
 * - Gera PDF via PdfService
 * - Gera filename seguro
 * - Salva no Drive (DriveStorage.savePrivatePdf)
 * - Registra evento no Sheets (SheetLogger.appendEvent) com event_type=SECOND_COPY_REQUEST
 * - Retorna { buffer? (opcional), driveFileId, filename } para o handler enviar via WhatsApp
 */
export class GenerateSecondCopyUseCase {
  constructor(
    private bankProvider: BankProvider,
    private pdfService: PdfService,
    private driveStorage: DriveStorage,
    private sheetLogger: SheetLogger,
    private logger: Logger
  ) {}

  async execute(
    from: string,
    cpfHash: string,
    cpfMasked: string,
    title: Title,
    requestId: string
  ): Promise<GenerateSecondCopyResult> {
    this.logger.info({ 
      requestId, 
      from, 
      cpfMasked, 
      nossoNumero: title.nossoNumero 
    }, 'Iniciando geração de segunda via');

    let pdfBuffer: Buffer;

    // Tentar obter PDF do banco primeiro
    const bankPdfResult = await this.bankProvider.getSecondCopyPdf(title);

    if (bankPdfResult && bankPdfResult.buffer) {
      // Usar PDF do banco
      this.logger.info({ requestId, nossoNumero: title.nossoNumero }, 'PDF obtido do banco');
      
      const buildParams: PdfBuildFromBankPdfParams = {
        bankPdfBuffer: bankPdfResult.buffer,
        filename: bankPdfResult.filename,
      };
      
      pdfBuffer = await this.pdfService.buildFromBankPdf(buildParams);
    } else {
      // Se não tiver PDF, obter dados e gerar
      this.logger.info({ requestId, nossoNumero: title.nossoNumero }, 'Obtendo dados do banco para gerar PDF');
      
      const bankDataResult = await this.bankProvider.getSecondCopyData(title);
      
      if (!bankDataResult) {
        throw new Error('Não foi possível obter PDF nem dados do banco');
      }

      const buildParams: PdfBuildFromDataParams = {
        data: {
          linhaDigitavel: bankDataResult.linhaDigitavel,
          valor: bankDataResult.valor,
          vencimento: bankDataResult.vencimento,
          nossoNumero: bankDataResult.nossoNumero,
          beneficiario: bankDataResult.beneficiario,
          pagador: bankDataResult.pagador,
        },
      };

      pdfBuffer = await this.pdfService.buildFromData(buildParams);
    }

    // Gerar filename seguro
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    
    // Obter últimos 4 dígitos do CPF e hash de 8 caracteres
    const cpfNormalized = cpfMasked.replace(/\D/g, '');
    const cpfUlt4 = cpfNormalized.slice(-4);
    const hash8 = cpfHash.slice(0, 8);

    let filename: string;
    const allowRawCpf = process.env.ALLOW_RAW_CPF_IN_FILENAME === 'true';
    
    if (allowRawCpf) {
      // WARNING: Usar CPF puro em filename - apenas se explicitamente permitido
      filename = `${cpfNormalized}_H${hours}_D${day}-${month}-${year}.pdf`;
      this.logger.warn({ requestId, cpfMasked }, 'ALLOW_RAW_CPF_IN_FILENAME=true: CPF puro será usado no filename');
    } else {
      // Filename seguro (padrão)
      filename = `${cpfUlt4}_${hash8}_H${hours}_D${day}-${month}-${year}.pdf`;
    }

    // Salvar no Drive
    const driveResult = await this.driveStorage.savePrivatePdf(pdfBuffer, filename);

    // Registrar evento no Sheets
    await this.sheetLogger.appendEvent(EventType.SECOND_COPY_REQUEST, {
      from,
      cpfHash,
      cpfMasked,
      titleId: title.id,
      nossoNumero: title.nossoNumero,
      driveFileId: driveResult.fileId,
      filename,
      requestId,
      timestamp: new Date().toISOString(),
    });

    this.logger.info({ 
      requestId, 
      from, 
      cpfMasked, 
      nossoNumero: title.nossoNumero,
      driveFileId: driveResult.fileId,
      filename 
    }, 'Segunda via gerada com sucesso');

    return {
      buffer: pdfBuffer, // Opcional - para enviar via WhatsApp
      driveFileId: driveResult.fileId,
      filename,
    };
  }
}
