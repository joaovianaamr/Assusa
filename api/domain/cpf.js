/**
 * CPF — regra de negócio pura.
 *
 * Camada domain: não importa framework, não faz I/O, não conhece WhatsApp nem
 * Sicoob. Tudo aqui é função de entrada → saída.
 */

"use strict";

/**
 * Extrai os dígitos de qualquer grafia aceita do CPF.
 *
 * O cliente digita como quiser — "123.456.789-00", "123 456 789 00", ou até uma
 * frase com o número dentro. O que vale são os 11 dígitos.
 */
function apenasDigitos(texto) {
  return String(texto ?? "").replace(/\D/g, "");
}

/**
 * Valida os dois dígitos verificadores (módulo 11) e recusa sequências
 * repetidas como 000.000.000-00, que passam no cálculo mas não existem.
 *
 * @param {string} digits CPF com exatamente 11 dígitos, sem pontuação.
 */
function cpfValido(digits) {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len) => {
    const soma = digits.slice(0, len).split("").reduce(
      (acc, d, i) => acc + Number(d) * (len + 1 - i), 0
    );
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

/**
 * Mascara o CPF para eco ao cliente: 12345678900 → 123.***.**9-00.
 * Mostra o suficiente para a pessoa reconhecer o número que digitou sem expor o
 * documento inteiro na conversa.
 */
function mascararCpf(digits) {
  const d = apenasDigitos(digits);
  if (d.length !== 11) return "";
  return `${d.slice(0, 3)}.***.**${d[8]}-${d.slice(9)}`;
}

module.exports = { apenasDigitos, cpfValido, mascararCpf };
