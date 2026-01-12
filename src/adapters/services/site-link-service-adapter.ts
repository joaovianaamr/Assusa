import { SiteLinkService } from '../../application/ports/driven/site-link-service.port.js';
import { SiteLinkResult } from '../../application/dtos/site-link-result.dto.js';
import { Config } from '../../infrastructure/config/config.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import { StoragePort } from '../../application/ports/driven/storage-port.js';
import crypto from 'crypto';

const TOKEN_PREFIX = 'site_token:';
const DEFAULT_TTL_MINUTES = 15;

/**
 * Adapter: Serviço de Link do Site
 * Gera links para acesso ao site com tokens opcionais
 */
export class SiteLinkServiceAdapter implements SiteLinkService {
  private baseUrl: string;

  constructor(
    _config: Config,
    private logger: Logger,
    private storage?: StoragePort
  ) {
    this.baseUrl = process.env.SITE_URL || 'https://www.assusa.com.br';
  }

  async generateLink(from: string, existingCpfHash?: string): Promise<SiteLinkResult> {
    try {
      // Se não houver configuração para token, retornar URL simples
      const enableToken = process.env.ENABLE_SITE_TOKEN === 'true';

      if (!enableToken || !existingCpfHash || !this.storage) {
        return {
          url: this.baseUrl,
          tokenUsed: false,
        };
      }

      // Gerar token temporário
      const token = crypto.randomBytes(32).toString('hex');
      const ttlMinutes = parseInt(process.env.SITE_TOKEN_TTL_MINUTES || String(DEFAULT_TTL_MINUTES), 10);
      const ttlSeconds = ttlMinutes * 60;
      
      // Armazenar token no Redis com TTL
      const tokenKey = `${TOKEN_PREFIX}${token}`;
      const tokenData = JSON.stringify({
        cpfHash: existingCpfHash,
        from,
        createdAt: new Date().toISOString(),
      });
      
      const requestId = crypto.randomUUID();
      await this.storage.set(tokenKey, tokenData, ttlSeconds, requestId);

      // Retornar URL com token como query param
      const url = `${this.baseUrl}?token=${token}`;

      this.logger.debug({ from, tokenUsed: true, ttlMinutes }, 'Link gerado com token armazenado no Redis');

      return {
        url,
        tokenUsed: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar link';
      this.logger.error({ from, error: errorMessage }, 'Erro ao gerar link do site');
      
      // Em caso de erro, retornar URL sem token
      return {
        url: this.baseUrl,
        tokenUsed: false,
      };
    }
  }
}
