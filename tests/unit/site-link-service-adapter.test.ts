import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SiteLinkServiceAdapter } from '../../src/adapters/services/site-link-service-adapter.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { StoragePort } from '../../src/application/ports/driven/storage-port.js';

describe('SiteLinkServiceAdapter', () => {
  let adapter: SiteLinkServiceAdapter;
  let mockConfig: Config;
  let mockLogger: Logger;
  let mockStorage: StoragePort;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    mockConfig = {
      nodeEnv: 'test',
      port: 3000,
      host: '0.0.0.0',
      whatsappApiToken: 'token',
      whatsappPhoneNumberId: 'phone-id',
      whatsappVerifyToken: 'verify-token',
      whatsappAppSecret: 'secret',
      sicoobClientId: 'client-id',
      sicoobClientSecret: 'secret',
      sicoobBaseUrl: 'https://api.sicoob.com.br',
      googleClientEmail: 'test@example.com',
      googlePrivateKey: 'key',
      googleProjectId: 'project',
      googleDriveFolderId: 'folder',
      googleSheetsSpreadsheetId: 'spreadsheet',
      googleSheetsWorksheetName: 'sheet',
      redisEnabled: false,
      cpfPepper: 'a'.repeat(32),
      allowRawCpfInFilename: false,
      dataRetentionDays: 90,
      logLevel: 'info',
      serviceName: 'test',
      rateLimitMaxRequests: 100,
      rateLimitWindowMs: 60000,
      conversationStateTtlSeconds: 900,
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockStorage = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      increment: vi.fn(),
      expire: vi.fn(),
    };

    adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('deve retornar URL simples quando token não está habilitado', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.ENABLE_SITE_TOKEN = 'false';

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger, mockStorage);
    const result = await adapter.generateLink('whatsapp-id-123');

    expect(result.url).toBe('https://example.com');
    expect(result.tokenUsed).toBe(false);
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('deve retornar URL simples quando existingCpfHash não é fornecido', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.ENABLE_SITE_TOKEN = 'true';

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger, mockStorage);
    const result = await adapter.generateLink('whatsapp-id-123');

    expect(result.url).toBe('https://example.com');
    expect(result.tokenUsed).toBe(false);
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('deve retornar URL simples quando StoragePort não é fornecido', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.ENABLE_SITE_TOKEN = 'true';

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger);
    const result = await adapter.generateLink('whatsapp-id-123', 'cpf-hash-123');

    expect(result.url).toBe('https://example.com');
    expect(result.tokenUsed).toBe(false);
  });

  it('deve gerar link com token quando habilitado e cpfHash fornecido', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.ENABLE_SITE_TOKEN = 'true';
    process.env.SITE_TOKEN_TTL_MINUTES = '15';

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger, mockStorage);
    const result = await adapter.generateLink('whatsapp-id-123', 'cpf-hash-123');

    expect(result.url).toContain('https://example.com?token=');
    expect(result.url).toMatch(/^https:\/\/example\.com\?token=[a-f0-9]{64}$/); // Token hex de 64 chars (32 bytes)
    expect(result.tokenUsed).toBe(true);
    
    // Verificar que token foi armazenado no Redis
    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.stringMatching(/^site_token:[a-f0-9]{64}$/),
      expect.stringContaining('cpf-hash-123'),
      900, // 15 minutos * 60 segundos
      expect.any(String) // requestId
    );
    
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ tokenUsed: true, ttlMinutes: 15 }),
      'Link gerado com token armazenado no Redis'
    );
  });

  it('deve usar URL padrão quando SITE_URL não está configurado', async () => {
    delete process.env.SITE_URL;
    process.env.ENABLE_SITE_TOKEN = 'false';

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger, mockStorage);
    const result = await adapter.generateLink('whatsapp-id-123');

    expect(result.url).toBe('https://www.assusa.com.br');
    expect(result.tokenUsed).toBe(false);
  });

  it('deve retornar URL sem token em caso de erro ao armazenar', async () => {
    process.env.SITE_URL = 'https://example.com';
    process.env.ENABLE_SITE_TOKEN = 'true';

    // Simular erro ao armazenar token
    const errorStorage = {
      ...mockStorage,
      set: vi.fn().mockRejectedValue(new Error('Erro ao armazenar')),
    };

    const adapter = new SiteLinkServiceAdapter(mockConfig, mockLogger, errorStorage);
    const result = await adapter.generateLink('whatsapp-id-123', 'cpf-hash-123');

    // Em caso de erro, deve retornar URL sem token
    expect(result.url).toBe('https://example.com');
    expect(result.tokenUsed).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
      'Erro ao gerar link do site'
    );
  });
});
