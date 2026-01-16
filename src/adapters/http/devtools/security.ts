import { Config } from '../../../infrastructure/config/config.js';

/**
 * Verifica se DevTools está habilitado
 * DevTools só pode ser habilitado quando:
 * - NODE_ENV !== 'production'
 * - ou DEV_TOOLS_ENABLED=true explicitamente
 */
export function isDevToolsEnabled(config: Config): boolean {
  if (config.nodeEnv === 'production') {
    return false;
  }
  return config.devToolsEnabled === true;
}

/**
 * Valida token de autenticação do DevTools
 * Se DEV_TOOLS_TOKEN estiver configurado, exige que o token seja fornecido
 */
export function validateDevToolsToken(config: Config, providedToken?: string): boolean {
  // Se não há token configurado, não exige autenticação
  if (!config.devToolsToken) {
    return true;
  }

  // Se há token configurado, exige que seja fornecido e seja igual
  return providedToken === config.devToolsToken;
}
