import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WhatsappRouter } from '../../../../application/services/whatsapp-router.js';
import { ConversationStateStore } from '../../../../application/ports/driven/conversation-state-store.js';
import { WhatsAppPort } from '../../../../application/ports/driven/whatsapp-port.js';
import { Config } from '../../../../infrastructure/config/config.js';
import { Logger } from '../../../../application/ports/driven/logger-port.js';
import { isDevToolsEnabled, validateDevToolsToken } from '../../devtools/security.js';
import { mapStartPointToState, FlowStartPoint } from '../../devtools/state-mapper.js';

const runRequestSchema = z.object({
  from: z.string().min(1),
  input: z.object({
    type: z.enum(['text', 'interactive']),
    text: z.string().optional(),
    payload: z.unknown().optional(),
  }),
  startAt: z
    .enum(['MENU', 'LGPD_NOTICE', 'WAITING_CPF', 'SELECT_TITLE', 'SELECT_FORMAT', 'CONFIRM', 'DONE'])
    .optional(),
  stateOverride: z.record(z.unknown()).optional(),
  useInMemory: z.boolean().optional().default(false),
});

const resetRequestSchema = z.object({
  from: z.string().min(1),
});

/**
 * Registra rotas do DevTools Flow Tester
 */
export async function devtoolsFlowTesterRoutes(
  fastify: FastifyInstance,
  options: {
    whatsappRouter: WhatsappRouter;
    conversationState: ConversationStateStore;
    whatsappAdapter: WhatsAppPort;
    config: Config;
    logger: Logger;
  }
): Promise<void> {
  const { whatsappRouter, conversationState, whatsappAdapter: _whatsappAdapter, config, logger } = options;

  // Middleware de segurança - bloquear em produção
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDevToolsEnabled(config)) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    // Validar token se configurado
    const providedToken = request.headers['x-dev-tools-token'] as string | undefined;
    if (!validateDevToolsToken(config, providedToken)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  // GET /devtools/flow-tester - Retorna HTML
  fastify.get('/devtools/flow-tester', async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assusa - Flow Tester</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 10px;
    }
    .container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
      color: #555;
    }
    input, select, textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    }
    textarea {
      min-height: 80px;
      font-family: monospace;
    }
    button {
      background: #4CAF50;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-right: 10px;
    }
    button:hover {
      background: #45a049;
    }
    button.secondary {
      background: #666;
    }
    button.secondary:hover {
      background: #555;
    }
    .output {
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin-top: 20px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-wrap: break-word;
      max-height: 600px;
      overflow-y: auto;
    }
    .error {
      color: #d32f2f;
      background: #ffebee;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }
    .success {
      color: #2e7d32;
      background: #e8f5e9;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <h1>🚀 Assusa Flow Tester</h1>
  
  <div class="container">
    <div class="form-group">
      <label for="from">From (WhatsApp ID):</label>
      <input type="text" id="from" value="5511999999999" placeholder="5511999999999">
    </div>
    
    <div class="form-group">
      <label for="startAt">Iniciar em:</label>
      <select id="startAt">
        <option value="">-- Sem estado inicial --</option>
        <option value="MENU">MENU</option>
        <option value="LGPD_NOTICE">LGPD_NOTICE</option>
        <option value="WAITING_CPF">WAITING_CPF</option>
        <option value="SELECT_TITLE">SELECT_TITLE</option>
        <option value="SELECT_FORMAT">SELECT_FORMAT</option>
        <option value="CONFIRM">CONFIRM</option>
        <option value="DONE">DONE</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="inputText">Mensagem de entrada:</label>
      <textarea id="inputText" placeholder="Digite a mensagem a ser processada..."></textarea>
    </div>
    
    <div class="form-group">
      <button onclick="runFlow()">▶️ Enviar</button>
      <button class="secondary" onclick="resetState()">🔄 Resetar Estado</button>
      <button class="secondary" onclick="getState()">📋 Ver Estado</button>
    </div>
  </div>
  
  <div class="container">
    <h2>Saída</h2>
    <div id="output" class="output">Aguardando execução...</div>
  </div>

  <script>
    async function runFlow() {
      const from = document.getElementById('from').value;
      const startAt = document.getElementById('startAt').value;
      const inputText = document.getElementById('inputText').value;
      const output = document.getElementById('output');
      
      if (!from || !inputText) {
        output.textContent = 'Erro: Preencha "From" e "Mensagem de entrada"';
        output.className = 'output error';
        return;
      }
      
      output.textContent = 'Processando...';
      output.className = 'output';
      
      try {
        const response = await fetch('/devtools/flow-tester/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            input: {
              type: 'text',
              text: inputText,
            },
            startAt: startAt || undefined,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          output.textContent = 'Erro: ' + JSON.stringify(data, null, 2);
          output.className = 'output error';
          return;
        }
        
        output.textContent = JSON.stringify(data, null, 2);
        output.className = 'output success';
      } catch (error) {
        output.textContent = 'Erro: ' + error.message;
        output.className = 'output error';
      }
    }
    
    async function resetState() {
      const from = document.getElementById('from').value;
      const output = document.getElementById('output');
      
      if (!from) {
        output.textContent = 'Erro: Preencha "From"';
        output.className = 'output error';
        return;
      }
      
      try {
        const response = await fetch('/devtools/flow-tester/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from }),
        });
        
        const data = await response.json();
        output.textContent = JSON.stringify(data, null, 2);
        output.className = 'output success';
      } catch (error) {
        output.textContent = 'Erro: ' + error.message;
        output.className = 'output error';
      }
    }
    
    async function getState() {
      const from = document.getElementById('from').value;
      const output = document.getElementById('output');
      
      if (!from) {
        output.textContent = 'Erro: Preencha "From"';
        output.className = 'output error';
        return;
      }
      
      try {
        const response = await fetch(\`/devtools/flow-tester/state?from=\${encodeURIComponent(from)}\`);
        const data = await response.json();
        output.textContent = JSON.stringify(data, null, 2);
        output.className = 'output';
      } catch (error) {
        output.textContent = 'Erro: ' + error.message;
        output.className = 'output error';
      }
    }
  </script>
</body>
</html>
    `;
    return reply.type('text/html').send(html);
  });

  // POST /devtools/flow-tester/run - Executa fluxo
  fastify.post('/devtools/flow-tester/run', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id as string;
    const startTime = Date.now();

    try {
      const body = runRequestSchema.parse(request.body);
      const { from, input, startAt, stateOverride } = body;

      // Criar capturador de mensagens (TODO: Implementar captura real de mensagens)
      // const messageCapturer = new WhatsAppMessageCapturer(whatsappAdapter);

      // Se startAt foi fornecido, injetar estado inicial
      if (startAt) {
        const initialState = mapStartPointToState(startAt as FlowStartPoint);
        if (initialState) {
          // Mesclar com stateOverride se fornecido
          const finalState = stateOverride
            ? { ...initialState, data: { ...initialState.data, ...stateOverride } }
            : initialState;

          await conversationState.set(from, finalState);
          logger.debug({ requestId, from, startAt }, 'Estado inicial injetado pelo DevTools');
        }
      } else if (stateOverride) {
        // Apenas stateOverride fornecido - mesclar com estado existente ou criar novo
        const currentState = await conversationState.get(from);
        const newState = currentState
          ? { ...currentState, data: { ...currentState.data, ...stateOverride } }
          : {
              activeFlow: null,
              step: 'MENU',
              data: stateOverride,
              updatedAt: new Date(),
            };
        await conversationState.set(from, newState);
      }

      // Processar mensagem
      const textToProcess = input.type === 'text' ? input.text || '' : '';

      // Processar usando o router
      // Nota: Para realmente capturar, precisaríamos injetar o capturador no router
      // Por enquanto, vamos usar o router normal e depois buscar estado

      await whatsappRouter.handleIncomingMessage(from, textToProcess, requestId);

      // Obter estado após processamento
      const stateAfter = await conversationState.get(from);

      // Obter mensagens capturadas (por enquanto vazio, pois não injetamos o capturador)
      // TODO: Para capturar mensagens reais, precisaríamos modificar o ApplicationService
      // ou criar um mecanismo de interceptação

      const timings = {
        requestReceived: startTime,
        requestCompleted: Date.now(),
        durationMs: Date.now() - startTime,
      };

      return {
        requestId,
        outgoingMessages: [], // TODO: Implementar captura real de mensagens
        stateAfter: stateAfter
          ? {
              activeFlow: stateAfter.activeFlow,
              step: stateAfter.step,
              data: stateAfter.data,
              updatedAt: stateAfter.updatedAt.toISOString(),
            }
          : null,
        debug: {
          matchedHandler: 'WhatsappRouter',
          timings,
        },
      };
    } catch (error) {
      logger.error({ requestId, error }, 'Erro ao executar flow tester');
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: error.errors,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // POST /devtools/flow-tester/reset - Limpa estado
  fastify.post('/devtools/flow-tester/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id as string;

    try {
      const body = resetRequestSchema.parse(request.body);
      const { from } = body;

      await conversationState.clear(from);

      logger.debug({ requestId, from }, 'Estado resetado pelo DevTools');

      return {
        success: true,
        message: 'Estado da conversa resetado',
        from,
      };
    } catch (error) {
      logger.error({ requestId, error }, 'Erro ao resetar estado');

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: error.errors,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /devtools/flow-tester/state - Retorna estado atual
  fastify.get('/devtools/flow-tester/state', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id as string;

    try {
      const { from } = request.query as { from?: string };

      if (!from) {
        return reply.code(400).send({
          error: 'Missing parameter',
          message: 'Parameter "from" is required',
        });
      }

      const state = await conversationState.get(from);

      if (!state) {
        return {
          from,
          state: null,
          message: 'Nenhum estado encontrado para este remetente',
        };
      }

      // Sanitizar dados sensíveis antes de retornar
      const sanitizedState = {
        activeFlow: state.activeFlow,
        step: state.step,
        data: state.data, // TODO: Aplicar sanitização profunda se necessário
        updatedAt: state.updatedAt.toISOString(),
      };

      return {
        from,
        state: sanitizedState,
      };
    } catch (error) {
      logger.error({ requestId, error }, 'Erro ao buscar estado');

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
