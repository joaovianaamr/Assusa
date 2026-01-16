import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do crypto para evitar necessidade de chave privada válida
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  const mockSign = {
    update: vi.fn().mockReturnThis(),
    sign: vi.fn().mockReturnValue('mock-signature-base64'),
  };
  return {
    ...actual,
    default: {
      ...actual.default,
      createSign: vi.fn(() => mockSign),
      randomUUID: actual.default.randomUUID,
    },
    createSign: vi.fn(() => mockSign),
    randomUUID: actual.default.randomUUID,
  };
});

// Mock do axios ANTES de importar qualquer coisa que use axios
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  
  const isAxiosErrorMock = vi.fn((error: unknown) => {
    const err = error as any;
    const hasIsAxiosError = err?.isAxiosError === true;
    const hasResponse = err?.response !== undefined && err?.response !== null;
    return hasIsAxiosError || hasResponse;
  });
  
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(),
      post: vi.fn(),
      isAxiosError: isAxiosErrorMock,
    },
    isAxiosError: isAxiosErrorMock,
  };
});

// Importar axios DEPOIS do mock
import axios, { AxiosInstance } from 'axios';
import { BradescoBankProviderAdapter, BradescoError } from '../../src/adapters/bradesco/bradesco-bank-provider-adapter.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { Title } from '../../src/domain/entities/title.js';

// Mock da instância axios
const mockAxiosInstance = {
  post: vi.fn(),
} as unknown as AxiosInstance;

describe('BradescoBankProviderAdapter', () => {
  let adapter: BradescoBankProviderAdapter;
  let mockConfig: Config;
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios.create para retornar nossa instância mockada
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
    
    vi.mocked(axios.isAxiosError).mockImplementation((error: unknown) => {
      const err = error as any;
      const hasIsAxiosError = err?.isAxiosError === true;
      const hasResponse = err?.response !== undefined && err?.response !== null;
      return hasIsAxiosError || hasResponse;
    });

    mockConfig = {
      bradescoEnv: 'prod',
      bradescoBaseUrl: 'https://openapi.bradesco.com.br',
      bradescoAuthUrl: 'https://openapi.bradesco.com.br/auth/server/v1.1/token',
      bradescoClientId: 'test-client-id',
      bradescoPrivateKeyPem: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bN1x3x1KJ8+5q3Q5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x
5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x
5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x
5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x5x
AgMBAAECggEBAK8kZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
QKBgQDh5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
QKBgQDJ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
QKBgQC5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z
-----END PRIVATE KEY-----`,
      bradescoBeneficiaryCnpj: '12345678000190',
      bradescoApiPrefix: '/v1/boleto',
      nodeEnv: 'test',
      port: 3000,
      host: '0.0.0.0',
      whatsappApiToken: 'test-token',
      whatsappPhoneNumberId: 'test-phone-id',
      whatsappVerifyToken: 'test-verify',
      whatsappAppSecret: 'test-secret',
      googleServiceAccountJsonBase64: 'test-json',
      googleDriveFolderId: 'test-folder',
      googleSheetsSpreadsheetId: 'test-sheet',
      googleSheetsWorksheetName: 'Requests',
      redisEnabled: false,
      cpfPepper: 'test-pepper-key-for-hashing-cpf-security-min-32-char',
      allowRawCpfInFilename: false,
      dataRetentionDays: 90,
      logLevel: 'info',
      serviceName: 'assusa',
      rateLimitMaxRequests: 100,
      rateLimitWindowMs: 60000,
      conversationStateTtlSeconds: 900,
      sicoobClientId: 'test',
      sicoobClientSecret: 'test',
      sicoobBaseUrl: 'https://api.sicoob.com.br/cobranca-bancaria/v3',
      sicoobAuthTokenUrl: 'https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token',
      sicoobNumeroCliente: '12345',
      sicoobCodigoModalidade: '01',
    } as Config;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new BradescoBankProviderAdapter(mockConfig, mockLogger);
  });

  describe('Autenticação OAuth2 JWT Bearer', () => {
    it('deve gerar JWT assertion corretamente', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);

      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: Buffer.from('%PDF-test-content').toString('base64'),
          },
        },
        status: 200,
      };

      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      await adapter.getSecondCopyPdf(title);

      // Verificar que autenticação foi chamada com grant_type e assertion
      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        mockConfig.bradescoAuthUrl,
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verificar que o body contém grant_type e assertion
      const callArgs = vi.mocked(axios.post).mock.calls[0];
      const body = callArgs[1] as URLSearchParams;
      expect(body.toString()).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
      expect(body.toString()).toContain('assertion=');
    });

    it('deve usar token em cache quando ainda é válido', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token-cached',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);

      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: Buffer.from('%PDF-test-content').toString('base64'),
          },
        },
        status: 200,
      };

      vi.mocked(mockAxiosInstance.post).mockResolvedValue(mockTituloResponse);

      // Primeira chamada - obtém token
      await adapter.getSecondCopyPdf(title);
      
      // Limpar mocks de post
      vi.mocked(axios.post).mockClear();

      // Segunda chamada - deve usar token em cache
      await adapter.getSecondCopyPdf(title);

      // Verificar que post não foi chamado novamente (token em cache)
      expect(vi.mocked(axios.post)).not.toHaveBeenCalled();
    });
  });

  describe('buildBradescoHeaders', () => {
    it('deve incluir headers obrigatórios: Authorization, cpf-cnpj, X-Brad-*', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const pdfContent = '%PDF-test-content';
      const pdfBase64 = Buffer.from(pdfContent).toString('base64');

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: pdfBase64,
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      await adapter.getSecondCopyPdf(title);

      // Verificar headers
      const callArgs = vi.mocked(mockAxiosInstance.post).mock.calls[0];
      const headers = callArgs[2]?.headers as Record<string, string>;

      expect(headers).toHaveProperty('Authorization', 'Bearer test-access-token');
      expect(headers).toHaveProperty('cpf-cnpj', '12345678000190');
      expect(headers).toHaveProperty('X-Brad-Nonce');
      expect(headers).toHaveProperty('X-Brad-Timestamp');
      expect(headers).toHaveProperty('X-Brad-Algorithm', 'SHA256');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Accept', 'application/json');
    });

    it('NÃO deve incluir headers extras por padrão', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const pdfContent = '%PDF-test-content';
      const pdfBase64 = Buffer.from(pdfContent).toString('base64');

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: pdfBase64,
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      await adapter.getSecondCopyPdf(title);

      const callArgs = vi.mocked(mockAxiosInstance.post).mock.calls[0];
      const headers = callArgs[2]?.headers as Record<string, string>;

      // Verificar que headers extras não estão presentes
      expect(headers).not.toHaveProperty('X-Custom-Header');
    });

    it('deve respeitar bradescoExtraHeaders quando habilitado', async () => {
      const configWithExtraHeaders: Config = {
        ...mockConfig,
        bradescoExtraHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      };

      const adapterWithExtra = new BradescoBankProviderAdapter(configWithExtraHeaders, mockLogger);

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const pdfContent = '%PDF-test-content';
      const pdfBase64 = Buffer.from(pdfContent).toString('base64');

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: pdfBase64,
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      await adapterWithExtra.getSecondCopyPdf(title);

      const callArgs = vi.mocked(mockAxiosInstance.post).mock.calls[0];
      const headers = callArgs[2]?.headers as Record<string, string>;

      // Verificar que header extra está presente
      expect(headers).toHaveProperty('X-Custom-Header', 'custom-value');
    });
  });

  describe('getSecondCopyPdf', () => {
    it('deve obter PDF convertendo Base64 para Buffer', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const pdfContent = '%PDF-test-content';
      const pdfBase64 = Buffer.from(pdfContent).toString('base64');

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            pdfBoleto: pdfBase64,
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).not.toBeNull();
      expect(result?.buffer).toBeInstanceOf(Buffer);
      expect(result?.buffer.toString()).toBe(pdfContent);
      expect(result?.mime).toBe('application/pdf');
      expect(result?.filename).toBe('boleto-123456.pdf');

      // Verificar que a chamada foi feita com os parâmetros corretos
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/boleto/titulo-consultar',
        expect.objectContaining({
          nossoNumero: '123456',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });

    it('deve retornar null quando pdfBoleto não está presente', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            // pdfBoleto ausente
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          nossoNumero: '123456',
        }),
        'PDF não encontrado na resposta do Bradesco'
      );
    });

    it('deve retornar null quando recebe 404', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
      } as any;

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockRejectedValueOnce(axiosError);

      const result = await adapter.getSecondCopyPdf(title);

      expect(result).toBeNull();
    });
  });

  describe('getSecondCopyData', () => {
    it('deve obter dados do boleto com linha digitável e código de barras', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockTituloResponse = {
        data: {
          resultado: {
            nossoNumero: '123456',
            linhaDigitavel: '12345.67890 12345.678901 12345.678901 1 23456789012345',
            codigoBarras: '12345678901234567890123456789012345678901234',
            valor: 100.50,
            dataVencimento: '2024-12-31',
          },
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const result = await adapter.getSecondCopyData(title);

      expect(result).not.toBeNull();
      expect(result?.nossoNumero).toBe('123456');
      expect(result?.linhaDigitavel).toBe('12345.67890 12345.678901 12345.678901 1 23456789012345');
      expect(result?.codigoBarras).toBe('12345678901234567890123456789012345678901234');
      expect(result?.valor).toBe(100.50);
      expect(result?.vencimento).toBeInstanceOf(Date);
    });

    it('deve retornar null quando resultado não está presente', async () => {
      const title: Title = {
        id: 'test-id',
        nossoNumero: '123456',
      };

      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockTituloResponse = {
        data: {
          // resultado ausente
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockTituloResponse);

      const result = await adapter.getSecondCopyData(title);

      expect(result).toBeNull();
    });
  });

  describe('buscarBoletosPorCPF', () => {
    it('deve buscar boletos por CPF com sucesso', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockListaResponse = {
        data: {
          resultado: [
            {
              nossoNumero: '123456',
              numeroDocumento: 'DOC001',
              valor: 100.50,
              vencimento: '2024-12-31',
              situacao: 'Aberto',
            },
          ],
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockListaResponse);

      const requestId = 'test-request-id';
      const result = await adapter.buscarBoletosPorCPF('12345678900', requestId);

      expect(result).toHaveLength(1);
      expect(result[0].nossoNumero).toBe('123456');
      expect(result[0].valor).toBe(100.50);
      expect(result[0].bank).toBe('BRADESCO');

      // Verificar que a chamada foi feita com os parâmetros corretos
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/boleto/listar-titulo-pendente',
        expect.objectContaining({
          cpfCnpj: '12345678900',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'cpf-cnpj': '12345678000190',
          }),
        })
      );
    });

    it('deve retornar todos os boletos (filtro é feito no AggregatedTitleRepositoryAdapter)', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockListaResponse = {
        data: {
          resultado: [
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
              valor: 200.50,
              vencimento: '2024-11-30',
              situacao: 'Liquidado',
            },
            {
              nossoNumero: '123458',
              numeroDocumento: 'DOC003',
              valor: 300.50,
              vencimento: '2024-10-31',
              situacao: 'Pendente',
            },
          ],
        },
        status: 200,
      };

      vi.mocked(axios.post).mockResolvedValueOnce(mockTokenResponse);
      vi.mocked(mockAxiosInstance.post).mockResolvedValueOnce(mockListaResponse);

      const requestId = 'test-request-id';
      const result = await adapter.buscarBoletosPorCPF('12345678900', requestId);

      // O adapter Bradesco retorna TODOS os boletos (filtro é feito no AggregatedTitleRepositoryAdapter)
      expect(result).toHaveLength(3);
      expect(result[0].situacao).toBe('Aberto');
      expect(result[1].situacao).toBe('Liquidado');
      expect(result[2].situacao).toBe('Pendente');
      expect(result.every(b => b.bank === 'BRADESCO')).toBe(true);
    });
  });
});
