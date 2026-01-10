/**
 * Resultado de uma tentativa de rate limit
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Port para gerenciar rate limiting
 */
export interface RateLimiter {
  /**
   * Registra uma tentativa e verifica se está dentro do limite
   * @param key Chave única para identificar o limite (ex: número de telefone)
   * @param limit Número máximo de tentativas permitidas
   * @param windowSeconds Janela de tempo em segundos
   * @returns Resultado indicando se a tentativa foi permitida e informações sobre o limite
   */
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
