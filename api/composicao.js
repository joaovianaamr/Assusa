/**
 * Composition root — o único lugar que enxerga todas as camadas.
 *
 * É aqui, e só aqui, que porta encontra adapter. Nenhum caso de uso importa
 * `sicoobHttp` ou `sessaoRedis`: eles recebem `boletos` e `sessao` e não sabem
 * o que há do outro lado. Por isso os testes conseguem trocar qualquer peça sem
 * mexer no código de produção.
 *
 * Fica fora das camadas de propósito — o linter de fronteira não o classifica,
 * porque a regra "ninguém vê todo mundo" precisa de exatamente uma exceção.
 */

"use strict";

const config = require("./config");

// domain — regras puras
const mensagens = require("./domain/mensagens");
const view = require("./domain/boleto");
const cpf = require("./domain/cpf");

// infrastructure — adapters que implementam as portas
const notificador = require("./infrastructure/whatsappGraph");
const sessao = require("./infrastructure/sessaoRedis");
const bancoBoletos = require("./infrastructure/sicoobHttp");
const telemetria = require("./infrastructure/telemetriaHttp");

// tradutores do payload da Meta (entrada)
const Message = require("../services/message");
const Status = require("../services/status");

// application — casos de uso
const criarMensageria = require("./application/mensageria");
const criarConsulta = require("./application/consultarPorCpf");
const criarListagem = require("./application/listagemBoletos");
const criarEntrega = require("./application/entregarSegundaVia");

// interface
const criarWebhookRouter = require("./interface/webhookRouter");

const base = { notificador, sessao, bancoBoletos, telemetria, mensagens, view, cpf, config };

const mensageria = criarMensageria(base);
const listagem = criarListagem({ ...base, mensageria });
const entrega = criarEntrega({ ...base, mensageria });
const consulta = criarConsulta({ ...base, mensageria, listagem });

const router = criarWebhookRouter({
  ...base, Message, Status, mensageria, consulta, listagem, entrega,
});

module.exports = { router, mensageria, consulta, listagem, entrega };
