import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveStorageAdapter } from '../../src/adapters/google/google-drive-storage-adapter.js';
import { DrivePort } from '../../src/application/ports/driven/drive-port.js';
import { Logger } from '../../src/application/ports/driven/logger-port.js';

describe('GoogleDriveStorageAdapter', () => {
  let adapter: GoogleDriveStorageAdapter;
  let mockDrivePort: DrivePort;
  let mockLogger: Logger;

  beforeEach(() => {
    mockDrivePort = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      getFileUrl: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new GoogleDriveStorageAdapter(mockDrivePort, mockLogger);
  });

  it('deve salvar PDF e retornar DriveSaveResult com fileId', async () => {
    const buffer = Buffer.from('PDF content');
    const filename = 'boleto-123.pdf';
    const fileId = 'drive-file-id-123';

    vi.mocked(mockDrivePort.uploadFile).mockResolvedValue(fileId);

    const result = await adapter.savePrivatePdf(buffer, filename);

    expect(result.fileId).toBe(fileId);
    expect(mockDrivePort.uploadFile).toHaveBeenCalledWith(
      filename,
      buffer,
      'application/pdf',
      expect.any(String)
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ fileId, filename }),
      'PDF salvo no Drive'
    );
  });

  it('deve lançar erro quando upload falha', async () => {
    const buffer = Buffer.from('PDF content');
    const filename = 'boleto-123.pdf';
    const error = new Error('Erro ao fazer upload');

    vi.mocked(mockDrivePort.uploadFile).mockRejectedValue(error);

    await expect(adapter.savePrivatePdf(buffer, filename)).rejects.toThrow('Falha ao salvar PDF');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ filename, error: 'Erro ao fazer upload' }),
      'Erro ao salvar PDF no Drive'
    );
  });

  it('deve excluir arquivo do Drive', async () => {
    const fileId = 'drive-file-id-123';

    vi.mocked(mockDrivePort.deleteFile).mockResolvedValue(undefined);

    await adapter.deleteFile(fileId);

    expect(mockDrivePort.deleteFile).toHaveBeenCalledWith(fileId, expect.any(String));
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ fileId }),
      'Arquivo excluído do Drive'
    );
  });

  it('deve lançar erro quando exclusão falha', async () => {
    const fileId = 'drive-file-id-123';
    const error = new Error('Erro ao deletar arquivo');

    vi.mocked(mockDrivePort.deleteFile).mockRejectedValue(error);

    await expect(adapter.deleteFile(fileId)).rejects.toThrow('Falha ao excluir arquivo');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ fileId, error: 'Erro ao deletar arquivo' }),
      'Erro ao excluir arquivo do Drive'
    );
  });
});
