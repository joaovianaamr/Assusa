import { BoletoBradesco, BuscarBoletosPorCPFParams } from '../../../domain/entities/boleto.js';

export interface BradescoPort {
  buscarBoletosPorCPF(cpf: string, requestId: string, params?: BuscarBoletosPorCPFParams): Promise<BoletoBradesco[]>;
}
