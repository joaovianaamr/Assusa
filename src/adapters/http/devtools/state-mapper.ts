import { ConversationState } from '../../../application/ports/driven/conversation-state-store.js';
import { FlowType } from '../../../domain/enums/flow-type.js';

/**
 * Tipos de pontos de partida no fluxo
 */
export type FlowStartPoint =
  | 'MENU'
  | 'LGPD_NOTICE'
  | 'WAITING_CPF'
  | 'SELECT_TITLE'
  | 'SELECT_FORMAT'
  | 'CONFIRM'
  | 'DONE';

/**
 * Mapeia um ponto de partida para um estado inicial de conversação
 * Usado pelo DevTools para simular diferentes pontos do fluxo
 */
export function mapStartPointToState(startAt: FlowStartPoint): ConversationState | null {
  const now = new Date();

  switch (startAt) {
    case 'MENU':
      // Estado inicial sem fluxo ativo
      return {
        activeFlow: null,
        step: 'MENU',
        data: {},
        updatedAt: now,
      };

    case 'LGPD_NOTICE':
      // Depois do LGPD, antes de pedir CPF
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'LGPD_NOTICE',
        data: {},
        updatedAt: now,
      };

    case 'WAITING_CPF':
      // Aguardando CPF do usuário
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_CPF',
        data: {},
        updatedAt: now,
      };

    case 'SELECT_TITLE':
      // Após receber CPF, aguardando seleção de título
      // Requer títulos no data.titles
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_SELECTION',
        data: {
          cpfHash: 'test_hash',
          cpfMasked: '***.***.***-**',
          titles: [
            {
              id: 'title_1',
              nossoNumero: '12345678',
              valor: 100.0,
              vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              bank: 'SICOOB',
            },
            {
              id: 'title_2',
              nossoNumero: '87654321',
              valor: 200.0,
              vencimento: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
              bank: 'BRADESCO',
            },
          ],
        },
        updatedAt: now,
      };

    case 'SELECT_FORMAT':
      // Após selecionar título, aguardando formato
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'WAITING_FORMAT_SELECTION',
        data: {
          cpfHash: 'test_hash',
          cpfMasked: '***.***.***-**',
          titles: [
            {
              id: 'title_1',
              nossoNumero: '12345678',
              valor: 100.0,
              vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              bank: 'SICOOB',
            },
          ],
          selectedTitle: {
            id: 'title_1',
            nossoNumero: '12345678',
            valor: 100.0,
            vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            bank: 'SICOOB',
          },
        },
        updatedAt: now,
      };

    case 'CONFIRM':
      // Após selecionar formato (estado intermediário antes de gerar)
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'CONFIRM',
        data: {
          cpfHash: 'test_hash',
          cpfMasked: '***.***.***-**',
          selectedTitle: {
            id: 'title_1',
            nossoNumero: '12345678',
            valor: 100.0,
            vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            bank: 'SICOOB',
          },
          format: 'PDF',
        },
        updatedAt: now,
      };

    case 'DONE':
      // Fluxo concluído (estado final)
      return {
        activeFlow: FlowType.SECOND_COPY,
        step: 'DONE',
        data: {
          cpfHash: 'test_hash',
          cpfMasked: '***.***.***-**',
        },
        updatedAt: now,
      };

    default:
      return null;
  }
}
