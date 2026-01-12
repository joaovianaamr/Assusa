import { SiteLinkService } from '../../application/ports/driven/site-link-service.port.js';
import { SiteLinkResult } from '../../application/dtos/site-link-result.dto.js';
import { Config } from '../../infrastructure/config/config.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Adapter: Serviço de Link do Site
 * Gera links para acesso ao site com tokens opcionais
 */
export class SiteLinkServiceAdapter implements SiteLinkService {
  private baseUrl: string;

  constructor(
    _config: Config,
    private logger: Logger
  ) {
    // Por enquanto, usar URL hardcoded - pode ser configurado via env no futuro
    this.baseUrl = process.env.SITE_URL || 'https://www.assusa.com.br';
  }

  async generateLink(from: string, existingCpfHash?: string): Promise<SiteLinkResult> {
    try {
      // Se não houver configuração para token, retornar URL simples
      const enableToken = process.env.ENABLE_SITE_TOKEN === 'true';

      if (!enableToken || !existingCpfHash) {
        return {
          url: this.baseUrl,
          tokenUsed: false,
        };
      }

      // Gerar token temporário
      const token = crypto.randomBytes(32).toString('hex');
      const ttlMinutes = parseInt(process.env.SITE_TOKEN_TTL_MINUTES || '15', 10);
      
      // Por enquanto, retornar URL com token como query param
      // Em produção, o token seria armazenado no Redis com TTL
      const url = `${this.baseUrl}?token=${token}&cpfHash=${existingCpfHash}`;

      this.logger.debug({ from, tokenUsed: true, ttlMinutes }, 'Link gerado com token');

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
