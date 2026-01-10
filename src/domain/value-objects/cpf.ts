/**
 * Value Object CPF
 * 
 * Regras:
 * - CPF puro nunca deve ser persistido na entidade de registro
 * - Sempre usar cpfLimpo (normalizado) e cpfMascarado
 */
export class Cpf {
  private readonly _cpfLimpo: string;
  private readonly _cpfMascarado: string;

  private constructor(cpfLimpo: string, cpfMascarado: string) {
    this._cpfLimpo = cpfLimpo;
    this._cpfMascarado = cpfMascarado;
  }

  /**
   * Cria uma instância de CPF a partir de uma string
   * Valida formato e dígitos verificadores
   */
  static create(cpf: string): Cpf {
    const cpfLimpo = Cpf.normalize(cpf);
    
    if (!Cpf.isValid(cpfLimpo)) {
      throw new Error('CPF inválido: formato ou dígitos verificadores incorretos');
    }

    const cpfMascarado = Cpf.mask(cpfLimpo);

    return new Cpf(cpfLimpo, cpfMascarado);
  }

  /**
   * Cria uma instância de CPF a partir de um CPF já validado
   * Útil para reconstruir de dados persistidos
   * Não valida o CPF (assume que já foi validado anteriormente)
   */
  static fromValidated(cpf: string): Cpf {
    const cpfLimpo = Cpf.normalize(cpf);
    const cpfMascarado = Cpf.mask(cpfLimpo);
    return new Cpf(cpfLimpo, cpfMascarado);
  }

  /**
   * Normaliza CPF removendo caracteres especiais
   */
  static normalize(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  /**
   * Valida CPF completo (formato + dígitos verificadores)
   */
  static isValid(cpf: string): boolean {
    const normalized = Cpf.normalize(cpf);
    
    if (normalized.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(normalized)) return false; // Todos dígitos iguais

    // Valida primeiro dígito verificador
    let sum = 0;
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(normalized.substring(i - 1, i)) * (11 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(normalized.substring(9, 10))) return false;

    // Valida segundo dígito verificador
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(normalized.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(normalized.substring(10, 11))) return false;

    return true;
  }

  /**
   * Mascara CPF no formato XXX.XXX.XXX-XX
   */
  static mask(cpfLimpo: string): string {
    const normalized = Cpf.normalize(cpfLimpo);
    if (normalized.length !== 11) {
      return normalized; // Retorna original se não tiver 11 dígitos
    }
    return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * CPF limpo (normalizado, apenas números)
   * NUNCA persistir este valor diretamente na entidade
   */
  get cpfLimpo(): string {
    return this._cpfLimpo;
  }

  /**
   * CPF mascarado no formato XXX.XXX.XXX-XX
   * Seguro para exibir em logs e interfaces
   */
  get cpfMascarado(): string {
    return this._cpfMascarado;
  }

  /**
   * Comparação de igualdade
   */
  equals(other: Cpf): boolean {
    return this._cpfLimpo === other._cpfLimpo;
  }

  /**
   * String representation (sempre retorna mascarado por segurança)
   */
  toString(): string {
    return this._cpfMascarado;
  }
}
