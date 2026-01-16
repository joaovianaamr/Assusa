import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregatedBankProviderAdapter } from '../../src/adapters/bradesco/aggregated-bank-provider-adapter.js';
import { BankProvider } from '../../src/application/ports/driven/bank-provider.port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { Title } from '../../src/domain/entities/title.js';
import { BankPdfResult } from '../../src/application/dtos/bank-pdf-result.dto.js';
import { BankDataResult } from '../../src/application/dtos/bank-data-result.dto.js';

describe('AggregatedBankProviderAdapter', () => {
  let adapter: AggregatedBankProviderAdapter;
  let mockSicoobProvider: BankProvider;
  let mockBradescoProvider: BankProvider;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSicoobProvider = {
      getSecondCopyPdf: vi.fn(),
      getSecondCopyData: vi.fn(),
    };

    mockBradescoProvider = {
      getSecondCopyPdf: vi.fn(),
      getSecondCopyData: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new AggregatedBankProviderAdapter(
      mockSicoobProvider,
      mockBradescoProvider,
      mockLogger
    );
  });

  describe('getSecondCopyPdf', () => {
    it('deve rotear para Sicoob quando title.bank é SICOOB', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        bank: 'SICOOB',
      };

      const mockResult: BankPdfResult = {
        buffer: Buffer.from('%PDF-test'),
        mime: 'application/pdf',
        filename: 'boleto-123456.pdf',
      };

      vi.mocked(mockSicoobProvider.getSecondCopyPdf).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyPdf).not.toHaveBeenCalled();
    });

    it('deve rotear para Bradesco quando title.bank é BRADESCO', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '789012',
        bank: 'BRADESCO',
      };

      const mockResult: BankPdfResult = {
        buffer: Buffer.from('%PDF-test'),
        mime: 'application/pdf',
        filename: 'boleto-789012.pdf',
      };

      vi.mocked(mockBradescoProvider.getSecondCopyPdf).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toEqual(mockResult);
      expect(mockBradescoProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockSicoobProvider.getSecondCopyPdf).not.toHaveBeenCalled();
    });

    it('deve tentar Sicoob primeiro quando title.bank não está definido', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankPdfResult = {
        buffer: Buffer.from('%PDF-test'),
        mime: 'application/pdf',
        filename: 'boleto-123456.pdf',
      };

      vi.mocked(mockSicoobProvider.getSecondCopyPdf).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyPdf).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { nossoNumero: '123456' },
        'Título sem informação de banco, tentando Sicoob primeiro'
      );
    });

    it('deve tentar Bradesco quando Sicoob retorna null', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankPdfResult = {
        buffer: Buffer.from('%PDF-test'),
        mime: 'application/pdf',
        filename: 'boleto-123456.pdf',
      };

      vi.mocked(mockSicoobProvider.getSecondCopyPdf).mockResolvedValueOnce(null);
      vi.mocked(mockBradescoProvider.getSecondCopyPdf).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
    });

    it('deve tentar Bradesco quando Sicoob lança erro', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankPdfResult = {
        buffer: Buffer.from('%PDF-test'),
        mime: 'application/pdf',
        filename: 'boleto-123456.pdf',
      };

      vi.mocked(mockSicoobProvider.getSecondCopyPdf).mockRejectedValueOnce(new Error('Sicoob error'));
      vi.mocked(mockBradescoProvider.getSecondCopyPdf).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyPdf).toHaveBeenCalledWith(title);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { nossoNumero: '123456', error: 'Sicoob error' },
        'Sicoob não retornou PDF, tentando Bradesco'
      );
    });
  });

  describe('getSecondCopyData', () => {
    it('deve rotear para Sicoob quando title.bank é SICOOB', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        bank: 'SICOOB',
      };

      const mockResult: BankDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockSicoobProvider.getSecondCopyData).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyData).not.toHaveBeenCalled();
    });

    it('deve rotear para Bradesco quando title.bank é BRADESCO', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '789012',
        bank: 'BRADESCO',
      };

      const mockResult: BankDataResult = {
        nossoNumero: '789012',
        linhaDigitavel: '78901.23456 78901.234567 78901.234567 7 89012345678901',
        codigoBarras: '78901234567890123456789012345678901234567890',
        valor: 200.50,
        vencimento: new Date('2024-11-30'),
      };

      vi.mocked(mockBradescoProvider.getSecondCopyData).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toEqual(mockResult);
      expect(mockBradescoProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockSicoobProvider.getSecondCopyData).not.toHaveBeenCalled();
    });

    it('deve tentar Sicoob primeiro quando title.bank não está definido', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockSicoobProvider.getSecondCopyData).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyData).not.toHaveBeenCalled();
    });

    it('deve tentar Bradesco quando Sicoob retorna null', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockSicoobProvider.getSecondCopyData).mockResolvedValueOnce(null);
      vi.mocked(mockBradescoProvider.getSecondCopyData).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyData).toHaveBeenCalledWith(title);
    });

    it('deve tentar Bradesco quando Sicoob lança erro', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
        // bank não definido
      };

      const mockResult: BankDataResult = {
        nossoNumero: '123456',
        linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
        codigoBarras: '12345678901234567890123456789012345678901234',
        valor: 100.50,
        vencimento: new Date('2024-12-31'),
      };

      vi.mocked(mockSicoobProvider.getSecondCopyData).mockRejectedValueOnce(new Error('Sicoob error'));
      vi.mocked(mockBradescoProvider.getSecondCopyData).mockResolvedValueOnce(mockResult);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toEqual(mockResult);
      expect(mockSicoobProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockBradescoProvider.getSecondCopyData).toHaveBeenCalledWith(title);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { nossoNumero: '123456', error: 'Sicoob error' },
        'Sicoob não retornou dados, tentando Bradesco'
      );
    });
  });
});
