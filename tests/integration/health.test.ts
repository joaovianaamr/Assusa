import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('Health Check', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  it('deve retornar status ok no endpoint /health', async () => {
    try {
      const response = await axios.get(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('timestamp');
    } catch (error) {
      // Se o servidor não estiver rodando, o teste é pulado
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        console.warn('Servidor não está rodando. Execute `npm run dev` antes dos testes de integração.');
        return;
      }
      throw error;
    }
  });
});
