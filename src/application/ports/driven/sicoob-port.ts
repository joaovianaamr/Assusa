import { BoletoSicoob, BuscarBoletosPorCPFParams, ConsultaBoletoParams, SicoobBoletoCompleto } from '../../../domain/entities/boleto.js';

export interface SicoobPort {
  buscarBoletosPorCPF(cpf: string, requestId: string, params?: BuscarBoletosPorCPFParams): Promise<BoletoSicoob[]>;
  gerarSegundaVia(nossoNumero: string, cpfHash: string, requestId: string): Promise<Buffer>;
  /**
   * Consulta boleto completo via GET /boletos
   * Permite consulta por nossoNumero, linhaDigitavel ou codigoBarras
   * Implementação interna - pronto para uso futuro
   */
  consultarBoleto(params: ConsultaBoletoParams, requestId: string): Promise<SicoobBoletoCompleto | null>;
}
