import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSheetLoggerAdapter } from '../../src/adapters/google/google-sheet-logger-adapter.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';
import { EventType } from '../../src/domain/enums/event-type.js';
import { Config } from '../../src/infrastructure/config/config.js';
import { GoogleAuth } from '../../src/infrastructure/utils/google-auth.js';

// Mock do Google Sheets API
const mockSheets = {
  spreadsheets: {
    get: vi.fn(),
    batchUpdate: vi.fn(),
    values: {
      get: vi.fn(),
      update: vi.fn(),
      append: vi.fn(),
    },
  },
};

// Mock do googleapis
vi.mock('googleapis', () => ({
  google: {
    sheets: vi.fn(() => mockSheets),
  },
}));

// Mock do GoogleAuth
vi.mock('../../src/infrastructure/utils/google-auth.js', () => ({
  GoogleAuth: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      getAuthClient: vi.fn(() => ({})),
    })),
  },
}));

describe('GoogleSheetLoggerAdapter', () => {
  let adapter: GoogleSheetLoggerAdapter;
  let mockLogger: Logger;
  let mockConfig: Config;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockConfig = {
      googleSheetsSpreadsheetId: 'test-spreadsheet-id',
      googleSheetsWorksheetName: 'Events',
      googleServiceAccountJsonBase64: 'dGVzdA==', // base64 de "test"
    } as Config;

    // Mock padrão: aba existe, cabeçalhos existem
    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              title: 'Events',
            },
          },
        ],
      },
    });

    mockSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [['TIMESTAMP', 'EVENT_TYPE', 'FROM_MASKED', 'CPF_HASH', 'CPF_MASKED', 'STATUS', 'DRIVE_FILE_ID', 'ERROR_CODE', 'EXTRA_JSON']],
      },
    });

    mockSheets.spreadsheets.values.append.mockResolvedValue({});
    mockSheets.spreadsheets.values.update.mockResolvedValue({});
    mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

    adapter = new GoogleSheetLoggerAdapter(mockConfig, mockLogger);
  });

  describe('appendEvent', () => {
    it('deve registrar evento com schema estruturado completo', async () => {
      const payload = {
        from: '5511999999999',
        cpfHash: 'abc123hash',
        cpfMasked: '***.***.***-12',
        fileId: 'drive-file-123',
        status: 'SUCCESS',
        timestamp: '2024-01-01T00:00:00.000Z',
        selectedIndex: 0,
        tokenUsed: true,
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Events!A:I',
          requestBody: {
            values: [
              [
                '2024-01-01T00:00:00.000Z',
                'SECOND_COPY_REQUEST',
                '55*******9999', // WhatsApp mascarado (13 dígitos: 55 + 7 asteriscos + 9999)
                'abc123hash',
                '***.***.***-12',
                'SUCCESS',
                'drive-file-123',
                '',
                expect.stringContaining('"selectedIndex":0'), // extra_json
              ],
            ],
          },
        })
      );
    });

    it('deve mascarar número do WhatsApp corretamente', async () => {
      const payload = {
        from: '5511999999999',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.CONTACT_REQUEST, payload);

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];
      expect(row[2]).toBe('55*******9999'); // from_masked (13 dígitos: 55 + 7 asteriscos + 9999)
    });

    it('deve determinar status ERROR quando há erro no payload', async () => {
      const payload = {
        from: '5511999999999',
        errorMessage: 'Erro ao processar',
        errorCode: 'ERR_001',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];
      expect(row[5]).toBe('ERROR'); // status
      expect(row[7]).toBe('ERR_001'); // error_code
    });

    it('deve determinar status SENT quando há fileId', async () => {
      const payload = {
        from: '5511999999999',
        fileId: 'drive-file-123',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];
      expect(row[5]).toBe('SENT'); // status
      expect(row[6]).toBe('drive-file-123'); // drive_file_id
    });

    it('deve incluir campos extras em extra_json', async () => {
      const payload = {
        from: '5511999999999',
        selectedIndex: 2,
        tokenUsed: true,
        customField: 'value',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];
      const extraJson = JSON.parse(row[8] as string);
      expect(extraJson.selectedIndex).toBe(2);
      expect(extraJson.tokenUsed).toBe(true);
      expect(extraJson.customField).toBe('value');
    });

    it('deve usar timestamp atual quando não fornecido', async () => {
      const payload = {
        from: '5511999999999',
      };

      const before = new Date();
      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);
      const after = new Date();

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];
      const timestamp = new Date(row[0] as string);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('deve não lançar erro quando Sheets API falha (não quebra fluxo principal)', async () => {
      mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('Erro no Sheets'));

      const payload = {
        from: '5511999999999',
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validação de campos proibidos', () => {
    it('deve rejeitar payload com CPF puro', async () => {
      const payload = {
        from: '5511999999999',
        cpf: '12345678901', // CPF puro proibido
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('campos proibidos'),
        }),
        'Erro ao registrar evento no Sheets'
      );
      expect(mockSheets.spreadsheets.values.append).not.toHaveBeenCalled();
    });

    it('deve rejeitar payload com token', async () => {
      const payload = {
        from: '5511999999999',
        token: 'secret-token-123', // Token proibido
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('campos proibidos'),
        }),
        'Erro ao registrar evento no Sheets'
      );
      expect(mockSheets.spreadsheets.values.append).not.toHaveBeenCalled();
    });

    it('deve rejeitar payload com access_token', async () => {
      const payload = {
        from: '5511999999999',
        access_token: 'secret-access-token',
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSheets.spreadsheets.values.append).not.toHaveBeenCalled();
    });

    it('deve rejeitar payload com password', async () => {
      const payload = {
        from: '5511999999999',
        password: 'secret-password',
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSheets.spreadsheets.values.append).not.toHaveBeenCalled();
    });

    it('deve rejeitar payload com CPF puro em string', async () => {
      const payload = {
        from: '5511999999999',
        message: 'CPF: 12345678901', // CPF puro em string
        timestamp: new Date().toISOString(),
      };

      await expect(adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSheets.spreadsheets.values.append).not.toHaveBeenCalled();
    });

    it('deve aceitar payload com cpfHash (hash é permitido)', async () => {
      const payload = {
        from: '5511999999999',
        cpfHash: 'a'.repeat(64), // Hash de 64 caracteres (válido)
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
    });

    it('deve aceitar payload com cpfMasked', async () => {
      const payload = {
        from: '5511999999999',
        cpfMasked: '***.***.***-12',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalled();
    });
  });

  describe('criação de aba', () => {
    it('deve criar aba se não existir', async () => {
      // Mock: aba não existe
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            {
              properties: {
                title: 'OutraAba',
              },
            },
          ],
        },
      });

      // Mock: cabeçalhos não existem
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [],
        },
      });

      const adapter = new GoogleSheetLoggerAdapter(mockConfig, mockLogger);

      const payload = {
        from: '5511999999999',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      // Deve criar aba
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          requestBody: {
            requests: [
              expect.objectContaining({
                addSheet: {
                  properties: {
                    title: 'Events',
                  },
                },
              }),
            ],
          },
        })
      );

      // Deve criar cabeçalhos
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Events!A1:I1',
        })
      );
    });
  });

  describe('ordem de colunas', () => {
    it('deve manter ordem fixa de colunas', async () => {
      const payload = {
        from: '5511999999999',
        cpfHash: 'hash123',
        cpfMasked: '***.***.***-12',
        fileId: 'file-123',
        errorCode: 'ERR_001',
        timestamp: new Date().toISOString(),
      };

      await adapter.appendEvent(EventType.SECOND_COPY_REQUEST, payload);

      const appendCall = mockSheets.spreadsheets.values.append.mock.calls[0][0];
      const row = appendCall.requestBody.values[0];

      // Verificar ordem: timestamp, event_type, from_masked, cpf_hash, cpf_masked, status, drive_file_id, error_code, extra_json
      expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // timestamp ISO
      expect(row[1]).toBe('SECOND_COPY_REQUEST'); // event_type
      expect(row[2]).toBe('55*******9999'); // from_masked (13 dígitos: 55 + 7 asteriscos + 9999)
      expect(row[3]).toBe('hash123'); // cpf_hash
      expect(row[4]).toBe('***.***.***-12'); // cpf_masked
      expect(row[5]).toBe('ERROR'); // status (quando há errorCode, status é ERROR)
      expect(row[6]).toBe('file-123'); // drive_file_id
      expect(row[7]).toBe('ERR_001'); // error_code
      expect(typeof row[8]).toBe('string'); // extra_json
    });
  });
});
