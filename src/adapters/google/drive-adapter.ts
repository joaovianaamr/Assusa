import { google } from 'googleapis';
import { DrivePort } from '../../domain/ports/drive-port.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

export class GoogleDriveAdapter implements DrivePort {
  private drive: ReturnType<typeof google.drive>;
  private folderId: string;

  constructor(private config: Config, private logger: Logger) {
    this.folderId = config.googleDriveFolderId;

    const auth = new google.auth.JWT({
      email: config.googleClientEmail,
      key: config.googlePrivateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    this.drive = google.drive({
      version: 'v3',
      auth,
    });
  }

  async uploadFile(
    fileName: string,
    fileContent: Buffer,
    mimeType: string,
    requestId: string
  ): Promise<string> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [this.folderId],
          // Tornar privado (apenas para o serviço)
          // A pasta já deve estar configurada como privada
        },
        media: {
          mimeType,
          body: fileContent,
        },
        fields: 'id, webViewLink',
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error('ID do arquivo não retornado');
      }

      // Definir permissões (apenas o serviço pode acessar)
      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: this.config.googleClientEmail,
        },
      });

      this.logger.info({ requestId, fileId, fileName }, 'Arquivo enviado para o Drive');

      return fileId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload';
      this.logger.error({ requestId, fileName, error: errorMessage }, 'Erro ao fazer upload para Drive');
      throw new Error(`Falha ao fazer upload: ${errorMessage}`);
    }
  }

  async deleteFile(fileId: string, requestId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId,
      }, {
        headers: {
          'X-Request-ID': requestId,
        },
      });

      this.logger.info({ requestId, fileId }, 'Arquivo deletado do Drive');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar arquivo';
      this.logger.error({ requestId, fileId, error: errorMessage }, 'Erro ao deletar arquivo do Drive');
      throw new Error(`Falha ao deletar arquivo: ${errorMessage}`);
    }
  }

  getFileUrl(fileId: string): string {
    // Retornar URL de visualização do arquivo (requer autenticação)
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  async getDownloadUrl(fileId: string, requestId: string): Promise<string> {
    try {
      const file = await this.drive.files.get({
        fileId,
        fields: 'webContentLink',
      });

      return file.data.webContentLink || this.getFileUrl(fileId);
    } catch (error) {
      this.logger.error({ requestId, fileId, error }, 'Erro ao obter URL de download');
      return this.getFileUrl(fileId);
    }
  }
}
