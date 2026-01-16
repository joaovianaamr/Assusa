import { TitleRepository } from '../../application/ports/driven/title-repository.port.js';
import { SicoobPort } from '../../application/ports/driven/sicoob-port.js';
import { Title } from '../../domain/entities/title.js';
import { Logger } from '../../application/ports/driven/logger-port.js';
import crypto from 'crypto';

/**
 * Adapter: Repositório de Títulos usando Sicoob
 * Converte BoletoSicoob[] em Title[] enriquecido com GET /boletos
 * 
 * Usa GET /pagadores/{cpf}/boletos para listar e GET /boletos para enriquecer
 * cada boleto com informações completas (pagador, histórico, etc.)
 */
export class SicoobTitleRepositoryAdapter implements TitleRepository {
  constructor(
    private sicoobPort: SicoobPort,
    private logger: Logger
  ) {}

  async findOpenTitlesByCpfHash(cpf: string, cpfHash: string): Promise<Title[]> {
    try {
      const requestId = crypto.randomUUID();
      
      // 1. Buscar lista de boletos do Sicoob usando CPF original
      const boletos = await this.sicoobPort.buscarBoletosPorCPF(cpf, requestId);

      // 2. Filtrar apenas boletos em aberto (situacao === 'Aberto' ou similar)
      const boletosAbertos = boletos.filter(
        boleto => boleto.situacao === 'Aberto' || boleto.situacao === 'ABERTO'
      );

      if (boletosAbertos.length === 0) {
        this.logger.debug({ cpfHash: cpfHash.slice(0, 8) + '...', count: 0 }, 'Nenhum boleto em aberto encontrado');
        return [];
      }

      // 3. Enriquecer cada boleto com informações completas via GET /boletos (paralelo)
      // Usar GET /boletos porque retorna informações mais completas que GET /pagadores/{cpf}/boletos
      // GET /boletos/segunda-via será usado apenas quando precisar gerar o PDF
      const boletosEnriquecidos = await Promise.allSettled(
        boletosAbertos.map(async (boleto) => {
          try {
            const boletoCompleto = await this.sicoobPort.consultarBoleto(
              { nossoNumero: parseInt(boleto.nossoNumero, 10) },
              requestId
            );
            
            // Se não encontrou via GET /boletos, usar dados básicos da lista
            if (!boletoCompleto) {
              this.logger.warn(
                { cpfHash: cpfHash.slice(0, 8) + '...', nossoNumero: boleto.nossoNumero },
                'Boleto não encontrado via GET /boletos, usando dados básicos da lista'
              );
              return boleto;
            }
            
            // Retornar boleto enriquecido (com dados completos)
            // Converter dataVencimento (string) para formato compatível
            const vencimentoEnriquecido = boletoCompleto.dataVencimento || boleto.vencimento || '';
            
            return {
              nossoNumero: String(boletoCompleto.nossoNumero),
              numeroDocumento: boletoCompleto.seuNumero || boleto.numeroDocumento || '',
              valor: boletoCompleto.valor || boleto.valor || 0,
              vencimento: vencimentoEnriquecido,
              situacao: boletoCompleto.situacaoBoleto || boleto.situacao || '',
            };
          } catch (error) {
            // Se falhar ao enriquecer, usar dados básicos da lista
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar boleto';
            this.logger.warn(
              { cpfHash: cpfHash.slice(0, 8) + '...', nossoNumero: boleto.nossoNumero, error: errorMessage },
              'Erro ao enriquecer boleto via GET /boletos, usando dados básicos da lista'
            );
            return boleto;
          }
        })
      );

      // 4. Converter para Title[], usando dados enriquecidos quando disponíveis
      const titles: Title[] = boletosEnriquecidos
        .filter((result): result is PromiseFulfilledResult<typeof boletosAbertos[0]> => 
          result.status === 'fulfilled'
        )
        .map((result) => {
          const boleto = result.value;
          return {
            id: crypto.randomUUID(),
            nossoNumero: boleto.nossoNumero,
            valor: boleto.valor,
            vencimento: boleto.vencimento ? new Date(boleto.vencimento) : undefined,
            status: boleto.situacao,
          };
        });

      this.logger.debug({ 
        cpfHash: cpfHash.slice(0, 8) + '...', 
        count: titles.length,
        totalConsultados: boletosAbertos.length,
        enriquecidos: boletosEnriquecidos.filter(r => r.status === 'fulfilled').length
      }, 'Títulos encontrados e enriquecidos no Sicoob');

      return titles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar títulos';
      this.logger.error({ cpfHash: cpfHash.slice(0, 8) + '...', error: errorMessage }, 'Erro ao buscar títulos no Sicoob');
      throw new Error(`Falha ao buscar títulos: ${errorMessage}`);
    }
  }
}
