import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SicoobTitleRepositoryAdapter } from '../../src/adapters/sicoob/sicoob-title-repository-adapter.js';
import { SicoobPort } from '../../src/application/ports/driven/sicoob-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { BoletoSicoob, SicoobBoletoCompleto } from '../../src/domain/entities/boleto.js';

describe('SicoobTitleRepositoryAdapter', () => {
  let adapter: SicoobTitleRepositoryAdapter;
  let mockSicoobPort: SicoobPort;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSicoobPort = {
      buscarBoletosPorCPF: vi.fn(),
      gerarSegundaVia: vi.fn(),
      consultarBoleto: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new SicoobTitleRepositoryAdapter(mockSicoobPort, mockLogger);
  });

  it('deve converter BoletoSicoob[] em Title[] filtrando apenas boletos abertos', async () => {
    const cpf = '12345678900';
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Aberto',
      },
      {
        nossoNumero: '12346',
        numeroDocumento: 'DOC002',
        valor: 200.75,
        vencimento: '2024-11-30',
        situacao: 'Liquidado',
      },
      {
        nossoNumero: '12347',
        numeroDocumento: 'DOC003',
        valor: 300.00,
        vencimento: '2024-10-31',
        situacao: 'ABERTO',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);
    
    // Mock do enriquecimento via GET /boletos (retorna null para usar dados básicos)
    vi.mocked(mockSicoobPort.consultarBoleto).mockResolvedValue(null);

    const titles = await adapter.findOpenTitlesByCpfHash(cpf, cpfHash);

    expect(titles).toHaveLength(2);
    expect(titles[0].nossoNumero).toBe('12345');
    expect(titles[0].valor).toBe(100.50);
    expect(titles[0].status).toBe('Aberto');
    expect(titles[1].nossoNumero).toBe('12347');
    expect(titles[1].status).toBe('ABERTO');
    expect(mockSicoobPort.buscarBoletosPorCPF).toHaveBeenCalledWith(cpf, expect.any(String));
    // Verificar que tentou enriquecer via GET /boletos
    expect(mockSicoobPort.consultarBoleto).toHaveBeenCalledTimes(2);
  });

  it('deve retornar array vazio quando não há boletos abertos', async () => {
    const cpf = '12345678900';
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Liquidado',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);
    vi.mocked(mockSicoobPort.consultarBoleto).mockResolvedValue(null);

    const titles = await adapter.findOpenTitlesByCpfHash(cpf, cpfHash);

    expect(titles).toHaveLength(0);
  });

  it('deve lançar erro quando SicoobPort falha', async () => {
    const cpf = '12345678900';
    const cpfHash = 'abc123hash';
    const error = new Error('Erro ao buscar boletos');

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockRejectedValue(error);

    await expect(adapter.findOpenTitlesByCpfHash(cpf, cpfHash)).rejects.toThrow('Falha ao buscar títulos');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Erro ao buscar boletos' }),
      'Erro ao buscar títulos no Sicoob'
    );
  });

  it('deve converter vencimento string para Date', async () => {
    const cpf = '12345678900';
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Aberto',
      },
    ];

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);
    vi.mocked(mockSicoobPort.consultarBoleto).mockResolvedValue(null);

    const titles = await adapter.findOpenTitlesByCpfHash(cpf, cpfHash);

    expect(titles[0].vencimento).toBeInstanceOf(Date);
    expect(titles[0].vencimento?.getFullYear()).toBe(2024);
  });

  it('deve enriquecer boletos com informações completas via GET /boletos', async () => {
    const cpf = '12345678900';
    const cpfHash = 'abc123hash';
    const boletos: BoletoSicoob[] = [
      {
        nossoNumero: '12345',
        numeroDocumento: 'DOC001',
        valor: 100.50,
        vencimento: '2024-12-31',
        situacao: 'Aberto',
      },
    ];

    const boletoCompleto: SicoobBoletoCompleto = {
      numeroCliente: 25546454,
      codigoModalidade: 1,
      numeroContaCorrente: 0,
      codigoEspecieDocumento: 'DM',
      dataEmissao: '2024-01-01',
      nossoNumero: 12345,
      seuNumero: 'DOC001-ENRICHED',
      identificacaoBoletoEmpresa: '4562',
      codigoBarras: '01234567890123456789012345678901234567890123',
      linhaDigitavel: '012345678901234567890123456789012345678901234567',
      identificacaoEmissaoBoleto: 1,
      identificacaoDistribuicaoBoleto: 1,
      valor: 150.75, // Valor enriquecido (diferente do básico)
      dataVencimento: '2024-12-31',
      dataLimitePagamento: '2024-12-31',
      valorAbatimento: 0,
      tipoDesconto: 0,
      dataPrimeiroDesconto: '',
      valorPrimeiroDesconto: 0,
      dataSegundoDesconto: '',
      valorSegundoDesconto: 0,
      dataTerceiroDesconto: '',
      valorTerceiroDesconto: 0,
      tipoMulta: 0,
      dataMulta: '',
      valorMulta: 0,
      tipoJurosMora: 0,
      dataJurosMora: '',
      valorJurosMora: 0,
      numeroParcela: 1,
      aceite: true,
      numeroDiasNegativacao: 60,
      numeroDiasProtesto: 30,
      quantidadeDiasFloat: 2,
      pagador: {
        numeroCpfCnpj: '98765432185',
        nome: 'Teste Pagador',
        endereco: 'Rua Teste',
        bairro: 'Bairro Teste',
        cidade: 'Cidade Teste',
        cep: '12345678',
        uf: 'SP',
        email: 'teste@teste.com',
      },
      beneficiarioFinal: {
        numeroCpfCnpj: '12345678901',
        nome: 'Teste Beneficiário',
      },
      mensagensInstrucao: ['Instrução 1'],
      listaHistorico: [],
      situacaoBoleto: 'Em Aberto',
      numeroContratoCobranca: 1,
    };

    vi.mocked(mockSicoobPort.buscarBoletosPorCPF).mockResolvedValue(boletos);
    vi.mocked(mockSicoobPort.consultarBoleto).mockResolvedValue(boletoCompleto);

    const titles = await adapter.findOpenTitlesByCpfHash(cpf, cpfHash);

    expect(titles).toHaveLength(1);
    expect(titles[0].nossoNumero).toBe('12345');
    // Deve usar valor enriquecido do GET /boletos (150.75) ao invés do básico (100.50)
    expect(titles[0].valor).toBe(150.75);
    expect(titles[0].status).toBe('Em Aberto');
    expect(mockSicoobPort.consultarBoleto).toHaveBeenCalledWith(
      { nossoNumero: 12345 },
      expect.any(String)
    );
  });
});
