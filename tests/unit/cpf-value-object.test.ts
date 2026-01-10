import { describe, it, expect } from 'vitest';
import { Cpf } from '../../src/domain/value-objects/cpf.js';

describe('Cpf Value Object', () => {
  describe('create', () => {
    it('deve criar CPF válido a partir de string formatada', () => {
      const cpf = Cpf.create('111.444.777-35');
      expect(cpf.cpfLimpo).toBe('11144477735');
      expect(cpf.cpfMascarado).toBe('111.444.777-35');
    });

    it('deve criar CPF válido a partir de string sem formatação', () => {
      const cpf = Cpf.create('11144477735');
      expect(cpf.cpfLimpo).toBe('11144477735');
      expect(cpf.cpfMascarado).toBe('111.444.777-35');
    });

    it('deve lançar erro para CPF inválido (dígitos verificadores incorretos)', () => {
      expect(() => {
        Cpf.create('12345678900');
      }).toThrow('CPF inválido: formato ou dígitos verificadores incorretos');
    });

    it('deve lançar erro para CPF com formato inválido (menos de 11 dígitos)', () => {
      expect(() => {
        Cpf.create('123456789');
      }).toThrow('CPF inválido: formato ou dígitos verificadores incorretos');
    });

    it('deve lançar erro para CPF com todos os dígitos iguais', () => {
      expect(() => {
        Cpf.create('00000000000');
      }).toThrow('CPF inválido: formato ou dígitos verificadores incorretos');

      expect(() => {
        Cpf.create('11111111111');
      }).toThrow('CPF inválido: formato ou dígitos verificadores incorretos');
    });

    it('deve criar CPF válido com diferentes CPFs válidos', () => {
      const cpf1 = Cpf.create('11144477735');
      const cpf2 = Cpf.create('98765432100');
      
      expect(cpf1.cpfLimpo).toBe('11144477735');
      expect(cpf2.cpfLimpo).toBe('98765432100');
      expect(cpf1.equals(cpf2)).toBe(false);
    });
  });

  describe('fromValidated', () => {
    it('deve criar CPF a partir de CPF já validado', () => {
      const cpf = Cpf.fromValidated('11144477735');
      expect(cpf.cpfLimpo).toBe('11144477735');
      expect(cpf.cpfMascarado).toBe('111.444.777-35');
    });

    it('deve criar CPF mesmo com string formatada', () => {
      const cpf = Cpf.fromValidated('111.444.777-35');
      expect(cpf.cpfLimpo).toBe('11144477735');
      expect(cpf.cpfMascarado).toBe('111.444.777-35');
    });
  });

  describe('normalize', () => {
    it('deve remover caracteres especiais do CPF', () => {
      expect(Cpf.normalize('111.444.777-35')).toBe('11144477735');
      expect(Cpf.normalize('11144477735')).toBe('11144477735');
      expect(Cpf.normalize('  111  .  444  .  777  -  35  ')).toBe('11144477735');
    });
  });

  describe('isValid', () => {
    it('deve validar CPF válido', () => {
      expect(Cpf.isValid('11144477735')).toBe(true);
      expect(Cpf.isValid('111.444.777-35')).toBe(true);
      expect(Cpf.isValid('98765432100')).toBe(true);
    });

    it('deve rejeitar CPF inválido', () => {
      expect(Cpf.isValid('12345678900')).toBe(false);
      expect(Cpf.isValid('00000000000')).toBe(false);
      expect(Cpf.isValid('11111111111')).toBe(false);
      expect(Cpf.isValid('123')).toBe(false);
      expect(Cpf.isValid('123456789012')).toBe(false);
    });
  });

  describe('mask', () => {
    it('deve mascarar CPF no formato XXX.XXX.XXX-XX', () => {
      expect(Cpf.mask('11144477735')).toBe('111.444.777-35');
      expect(Cpf.mask('111.444.777-35')).toBe('111.444.777-35');
    });

    it('deve retornar original se CPF não tiver 11 dígitos', () => {
      expect(Cpf.mask('123')).toBe('123');
      expect(Cpf.mask('123456789')).toBe('123456789');
    });
  });

  describe('getters', () => {
    it('deve retornar cpfLimpo normalizado', () => {
      const cpf = Cpf.create('111.444.777-35');
      expect(cpf.cpfLimpo).toBe('11144477735');
    });

    it('deve retornar cpfMascarado formatado', () => {
      const cpf = Cpf.create('11144477735');
      expect(cpf.cpfMascarado).toBe('111.444.777-35');
    });
  });

  describe('equals', () => {
    it('deve retornar true para CPFs iguais', () => {
      const cpf1 = Cpf.create('11144477735');
      const cpf2 = Cpf.create('111.444.777-35');
      expect(cpf1.equals(cpf2)).toBe(true);
    });

    it('deve retornar false para CPFs diferentes', () => {
      const cpf1 = Cpf.create('11144477735');
      const cpf2 = Cpf.create('98765432100');
      expect(cpf1.equals(cpf2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('deve retornar CPF mascarado por segurança', () => {
      const cpf = Cpf.create('11144477735');
      expect(cpf.toString()).toBe('111.444.777-35');
      expect(String(cpf)).toBe('111.444.777-35');
    });
  });
});
