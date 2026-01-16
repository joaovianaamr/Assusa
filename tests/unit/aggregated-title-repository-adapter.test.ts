import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregatedTitleRepositoryAdapter } from '../../src/adapters/bradesco/aggregated-title-repository-adapter.js';
import { SicoobPort } from '../../src/application/ports/driven/sicoob-port.js';
import { BradescoPort } from '../../src/application/ports/driven/bradesco-port.js';
import { SheetLogger } from '../../src/application/ports/driven/sheet-logger.port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { EventType } from '../../src/domain/enums/event-type.js';

describe('AggregatedTitleRepositoryAdapter', () => {
  let adapter: AggregatedTitleRepositoryAdapter;
  let mockSicoobPort: SicoobPort;
  let mockBradescoPort: BradescoPort;
  let mockSheetLogger: SheetLogger;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSicoobPort = {
      buscarBoletosPorCPF: vi.fn(),
      gerarSegundaVia: vi.fn(),
      consultarBoleto: vi.fn(),
    };

    mockBradescoPort = {
      buscarBoletosPorCPF: vi.fn(),
    };

    mockSheetLogger = {
      appendEvent: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new AggregatedTitleRepositoryAdapter(
      mockSicoobPort,
      mockBradescoPort,
      mockSheetLogger,
      mockLogger
    );
  });

  describe('findOpenTitlesByCpfHash', () => {
    it('deve retornar vazio quando ambos bancos retornam vazio', async () => {
      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce([]);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce([]);

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ count: 0 }),
        'Nenhum boleto em aberto encontrado'
      );
    });

    it('deve retornar títulos do Sicoob quando apenas Sicoob tem boletos', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce([]);

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(1);
      expect(result[0].nossoNumero).toBe('123456');
      expect(result[0].bank).toBe('SICOOB');
      expect(result[0].valor).toBe(100.50);
    });

    it('deve retornar títulos do Bradesco quando apenas Bradesco tem boletos', async () => {
      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 200.50,
          vencimento: '2024-11-30',
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce([]);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(1);
      expect(result[0].nossoNumero).toBe('789012');
      expect(result[0].bank).toBe('BRADESCO');
      expect(result[0].valor).toBe(200.50);
    });

    it('deve unir títulos de ambos bancos', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 200.50,
          vencimento: '2024-11-30',
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(2);
      expect(result[0].bank).toBe('SICOOB');
      expect(result[1].bank).toBe('BRADESCO');
    });

    it('deve continuar mesmo se Sicoob falhar', async () => {
      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 200.50,
          vencimento: '2024-11-30',
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockRejectedValueOnce(new Error('Sicoob error'));
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(1);
      expect(result[0].bank).toBe('BRADESCO');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Sicoob error' }),
        'Erro ao buscar boletos no Sicoob'
      );
    });

    it('deve continuar mesmo se Bradesco falhar', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockRejectedValueOnce(new Error('Bradesco error'));

      const result = await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      expect(result).toHaveLength(1);
      expect(result[0].bank).toBe('SICOOB');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Bradesco error' }),
        'Erro ao buscar boletos no Bradesco'
      );
    });
  });

  describe('Detecção de Duplicidade', () => {
    it('deve detectar duplicidade quando há boletos iguais em bancos diferentes', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 100.50, // Mesmo valor
          vencimento: '2024-12-31', // Mesmo mês
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      // Verificar que evento de duplicidade foi registrado
      expect(mockSheetLogger.appendEvent).toHaveBeenCalledWith(
        EventType.DUPLICATE_BANK_TITLE,
        expect.objectContaining({
          cpfHash: 'hash123',
          month: '2024-12',
          amount: 100.50,
        })
      );
      
      // Verificar que banks contém ambos os bancos
      const callArgs = vi.mocked(mockSheetLogger.appendEvent).mock.calls[0];
      const payload = callArgs[1] as any;
      expect(payload.banks).toContain('SICOOB');
      expect(payload.banks).toContain('BRADESCO');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          month: '2024-12',
          valor: 100.50,
          banks: expect.stringContaining('SICOOB'),
        }),
        'Duplicidade detectada entre bancos diferentes'
      );
    });

    it('NÃO deve detectar duplicidade quando boletos são do mesmo banco', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
        {
          nossoNumero: '123457',
          numeroDocumento: 'DOC002',
          valor: 100.50, // Mesmo valor
          vencimento: '2024-12-31', // Mesmo mês
          situacao: 'Aberto',
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce([]);

      await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      // Não deve registrar duplicidade (mesmo banco)
      expect(mockSheetLogger.appendEvent).not.toHaveBeenCalledWith(
        EventType.DUPLICATE_BANK_TITLE,
        expect.anything()
      );
    });

    it('NÃO deve detectar duplicidade quando valores são diferentes', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 200.50, // Valor diferente
          vencimento: '2024-12-31', // Mesmo mês
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      // Não deve registrar duplicidade (valores diferentes)
      expect(mockSheetLogger.appendEvent).not.toHaveBeenCalledWith(
        EventType.DUPLICATE_BANK_TITLE,
        expect.anything()
      );
    });

    it('NÃO deve detectar duplicidade quando meses são diferentes', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.50,
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 100.50, // Mesmo valor
          vencimento: '2024-11-30', // Mês diferente
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      // Não deve registrar duplicidade (meses diferentes)
      expect(mockSheetLogger.appendEvent).not.toHaveBeenCalledWith(
        EventType.DUPLICATE_BANK_TITLE,
        expect.anything()
      );
    });

    it('deve arredondar valores para 2 casas decimais na comparação', async () => {
      const boletosSicoob = [
        {
          nossoNumero: '123456',
          numeroDocumento: 'DOC001',
          valor: 100.501, // Será arredondado para 100.50
          vencimento: '2024-12-31',
          situacao: 'Aberto',
        },
      ];

      const boletosBradesco = [
        {
          nossoNumero: '789012',
          numeroDocumento: 'DOC002',
          valor: 100.499, // Será arredondado para 100.50
          vencimento: '2024-12-31',
          situacao: 'Aberto',
          bank: 'BRADESCO' as const,
        },
      ];

      vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosSicoob);
      vi.mocked(mockBradescoPort.buscarBoletosPorCPF).mockResolvedValueOnce(boletosBradesco);

      await adapter.findOpenTitlesByCpfHash('12345678900', 'hash123');

      // Deve detectar duplicidade (valores arredondados são iguais)
      expect(mockSheetLogger.appendEvent).toHaveBeenCalledWith(
        EventType.DUPLICATE_BANK_TITLE,
        expect.objectContaining({
          amount: 100.50,
        })
      );
    });
  });
});
