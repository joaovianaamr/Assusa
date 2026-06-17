/**
 * Notificação de atendente por e-mail (SMTP via nodemailer).
 *
 * Padrão defensivo: se as variáveis SMTP não estiverem configuradas, faz no-op
 * com aviso. O envio é fire-and-forget — uma falha de e-mail nunca quebra a
 * resposta ao cliente no WhatsApp.
 */

"use strict";

const nodemailer = require("nodemailer");
const config = require("./config");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // 465 = SSL; 587/25 = STARTTLS
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
  return transporter;
}

/**
 * Avisa o atendente que um cliente pediu atendimento humano.
 * @param {{ telefone: string, cpf?: string|null }} dados
 */
function notificarAtendente({ telefone, cpf = null } = {}) {
  const t = getTransporter();
  if (!t || !config.atendenteEmailTo) {
    console.warn("[mailer] SMTP/destinatário não configurado — notificação de atendente ignorada");
    return;
  }

  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const linhas = [
    "Um cliente solicitou atendimento humano pelo WhatsApp.",
    "",
    `WhatsApp do cliente: +${telefone}`,
    cpf ? `CPF informado: ${cpf}` : "CPF: não informado",
    `Data/hora: ${quando}`,
  ];

  t.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to: config.atendenteEmailTo,
    subject: "Bot Assusa — cliente quer falar com atendente",
    text: linhas.join("\n"),
  }).catch(err => {
    console.error("[mailer] falha ao enviar notificação de atendente:", err?.message || err);
  });
}

module.exports = { notificarAtendente };
