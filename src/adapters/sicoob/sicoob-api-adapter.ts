import axios, { AxiosInstance } from 'axios';
import https from 'https';
import fs from 'fs/promises';
import { SicoobPort } from '../../domain/ports/sicoob-port.js';
import { BoletoSicoob } from '../../domain/entities/boleto.js';
import { Logger } from '../../domain/ports/logger-port.js';
import { Config } from '../../infrastructure/config/config.js';

interface SicoobAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SicoobBoletoResponse {
  nossoNumero: string;
  numeroDocumento: string;
  valor: number;
  dataVencimento: string;
  situacao: string;
}

export class SicoobApiAdapter implements SicoobPort {
  private api: AxiosInstance;
  private authToken?: string;
  private tokenExpiresAt?: Date;

  constructor(private config: Config, private logger: Logger) {
    this.api = axios.create({
      baseURL: config.sicoobBaseUrl,
    });
  }

  private async getAuthToken(requestId: string): Promise<string> {
    // Verificar se token ainda é válido
    if (this.authToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      // Configurar certificado SSL se fornecido
      let httpsAgent: https.Agent | undefined;
      if (this.config.sicoobCertificatePath && this.config.sicoobKeyPath) {
        const cert = await fs.readFile(this.config.sicoobCertificatePath);
        const key = await fs.readFile(this.config.sicoobKeyPath);
        
        httpsAgent = new https.Agent({
          cert,
          key,
        });
      }

      const response = await axios.post<SicoobAuthResponse>(
        `${this.config.sicoobBaseUrl}/auth/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.sicoobClientId,
          client_secret: this.config.sicoobClientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          httpsAgent,
        }
      );

      this.authToken = response.data.access_token;
      // Expira 5 minutos antes do tempo real para evitar problemas
      this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      this.logger.debug({ requestId }, 'Token Sicoob obtido com sucesso');

      return this.authToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao autenticar no Sicoob';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao autenticar no Sicoob');
      throw new Error(`Falha na autenticação Sicoob: ${errorMessage}`);
    }
  }

  async buscarBoletosPorCPF(cpfHash: string, requestId: string): Promise<BoletoSicoob[]> {
    try {
      const token = await this.getAuthToken(requestId);

      // Nota: A API do Sicoob normalmente busca por CPF diretamente
      // Como estamos usando hash, precisamos adaptar. Em produção, pode ser necessário
      // buscar todos os boletos e filtrar, ou ter uma tabela de mapeamento.
      // Por enquanto, vamos assumir que a API do Sicoob pode buscar por CPF hash
      // ou que temos uma forma de mapear o hash para o CPF original (que não deve ser armazenado).
      
      // Esta é uma implementação simplificada. Em produção, adaptar conforme a API real do Sicoob.
      const response = await this.api.get<SicoobBoletoResponse[]>(
        '/boletos', // Endpoint real pode variar
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Request-ID': requestId,
          },
          // Nota: A API real do Sicoob provavelmente não aceita hash de CPF diretamente
          // Seria necessário ter um sistema intermediário ou usar outra abordagem
          params: {
            // Adaptar conforme documentação real da API
            cpfHash, // Isso provavelmente não funcionará diretamente - é um exemplo
          },
        }
      );

      const boletos: BoletoSicoob[] = response.data.map(boleto => ({
        nossoNumero: boleto.nossoNumero,
        numeroDocumento: boleto.numeroDocumento,
        valor: boleto.valor,
        vencimento: boleto.dataVencimento,
        situacao: boleto.situacao,
      }));

      this.logger.info({ requestId, count: boletos.length }, 'Boletos encontrados no Sicoob');

      return boletos;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar boletos';
      this.logger.error({ requestId, error: errorMessage }, 'Erro ao buscar boletos no Sicoob');
      throw new Error(`Falha ao buscar boletos: ${errorMessage}`);
    }
  }

  async gerarSegundaVia(nossoNumero: string, _cpfHash: string, requestId: string): Promise<Buffer> {
    try {
      const token = await this.getAuthToken(requestId);

      // Buscar PDF da 2ª via
      const response = await this.api.get(
        `/boletos/${nossoNumero}/pdf`, // Endpoint real pode variar
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Request-ID': requestId,
          },
          responseType: 'arraybuffer',
        }
      );

      const pdfBuffer = Buffer.from(response.data);

      this.logger.info({ requestId, nossoNumero, pdfSize: pdfBuffer.length }, 'PDF da 2ª via gerado');

      return pdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar 2ª via';
      this.logger.error({ requestId, nossoNumero, error: errorMessage }, 'Erro ao gerar PDF da 2ª via');
      throw new Error(`Falha ao gerar 2ª via: ${errorMessage}`);
    }
  }
}
