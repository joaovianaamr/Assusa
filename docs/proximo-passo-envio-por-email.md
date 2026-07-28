# Próximo passo — envio automático da 2ª via por e-mail

Proposta para o bot entregar o boleto também por e-mail, além do WhatsApp.

> Status: **não iniciado**. Este documento levanta o que existe, o que falta e as decisões que
> precisam ser tomadas antes de escrever qualquer código.

## O bloqueio: não temos o e-mail do cliente

Este é o ponto que decide o formato da funcionalidade, e não há como contorná-lo com código.

Hoje o bot conhece do cliente exatamente duas coisas:

| Dado | De onde vem |
|---|---|
| Telefone | do payload do WhatsApp (`message.from`) |
| CPF | digitado pelo cliente na conversa |

E o que o Sicoob devolve sobre o pagador é só isto:

```json
"pagador": { "numeroCpfCnpj": "98765432185", "nome": "Marcelo dos Santos" }
```

Sem e-mail. A tabela `interacoes` no Postgres guarda `telefone`, `evento`, `cpf` e `detalhes` —
também sem e-mail, e ela é registro de atendimento, não cadastro de cliente.

**Não existe hoje nenhuma fonte de e-mail no sistema.** Antes de qualquer implementação é
preciso responder de onde ele virá. As opções, com o que cada uma implica:

### A. Perguntar ao cliente na conversa

O bot pede o e-mail depois de entregar o boleto ("quer que eu envie também por e-mail?").

- Funciona sem depender de nada externo e o consentimento é explícito, o que ajuda na LGPD.
- Custa um passo a mais na conversa, e digitar e-mail no celular é justamente onde o público
  idoso mais erra — o mesmo motivo que levou o fluxo a aceitar CPF em qualquer formatação.
- Exige guardar o e-mail para não perguntar toda vez, e aí entra retenção de dado pessoal novo.

### B. Buscar num cadastro da Assusa

Se existe um sistema de cadastro de associados com e-mail, o bot consulta por CPF.

- Zero atrito para o cliente e nenhum dado novo coletado por nós.
- **Depende de informação que só o operador tem:** esse cadastro existe? É consultável por API,
  banco ou exportação? Está atualizado?

### C. Não enviar por e-mail

O WhatsApp já entrega PDF, linha digitável e PIX, e o cliente pode encaminhar. Vale perguntar
que problema o e-mail resolve que hoje não está resolvido — se for "ter o boleto no computador
para pagar pelo internet banking", o caso é real; se for redundância, o custo pode não se pagar.

## O que já existe e pode ser reaproveitado

- **`services/mailer.js`, removido em `9248ae2`.** Usava `nodemailer` com SMTP e o padrão certo
  para este caso: *fire-and-forget* com no-op se as variáveis não estiverem configuradas — o
  envio nunca derrubava a resposta ao cliente. Recuperável com `git show 9248ae2^:services/mailer.js`.
- **As variáveis `SMTP_*` e `ATENDENTE_EMAIL_TO`**, removidas do `api/config.js` e do
  `.env.sample` no mesmo commit.
- **`nodemailer` saiu do `package.json`** e precisaria voltar.
- **O PDF já está em mãos**: `entregarSegundaVia.js` recebe `resultado.pdfBoleto` em base64 do
  Sicoob antes de subir para a Meta. O anexo do e-mail sai daí, sem nova chamada ao banco.
- **`contato@assusa.tech`** já é o endereço público, citado na página institucional e na
  política de privacidade.

## Onde isso entraria na arquitetura

O desenho atual já acomoda a funcionalidade sem exceção:

- **Porta nova** em `api/domain/portas/index.js`: `EMAIL`, com a operação `enviarBoleto`.
- **Adapter** `api/infrastructure/emailSmtp.js`, implementando essa porta — é o antigo
  `mailer.js` adaptado.
- **O caso de uso `entregarSegundaVia`** ganha a chamada, recebendo `email` por parâmetro como
  todas as outras portas. Nenhum arquivo de `application/` importa adapter, e isso não muda.
- Se a opção **A** for escolhida, entra um estado novo na máquina (`aguardando_email`) em
  `interface/webhookRouter.js`, e a validação de endereço vira `api/domain/email.js` — regra
  pura, testável sem rede, como `cpf.js`.

`test/portas.test.js` passa a cobrir o novo adapter automaticamente ao registrar a porta.

## O que precisa ser resolvido fora do código

- **LGPD.** A política de privacidade em `web/privacy.html` descreve os dados coletados hoje;
  e-mail seria **dado pessoal novo**, com base legal, finalidade e prazo de retenção próprios.
  A política precisa ser atualizada **antes** do recurso ir ao ar, não depois.
- **Entregabilidade.** Enviar boleto por e-mail a partir de domínio próprio exige SPF, DKIM e
  DMARC configurados em `assusa.tech`, ou a mensagem cai em spam — e um boleto no spam é pior
  que não enviar. Vale considerar um serviço transacional em vez de SMTP direto.
- **Anexo com dado financeiro.** O PDF do boleto trafega por e-mail, que não é canal cifrado
  fim a fim. Decidir se anexa o PDF ou envia link temporário.

## Verificação, quando for implementado

1. `npm test` sem Redis, como é a regra — a validação de e-mail entra como regra de domínio pura.
2. `boundary_lint` continua limpo: o adapter em `infrastructure/`, a porta em `domain/`.
3. `test/portas.test.js` confirma que o adapter cumpre a porta.
4. Envio real para uma caixa de teste, conferindo que o PDF abre e que a mensagem **não** cai em
   spam — é o teste que de fato importa e o único que os outros não cobrem.
5. Falha de SMTP não pode quebrar o atendimento: com o e-mail fora do ar, o cliente ainda recebe
   tudo pelo WhatsApp. Mesmo padrão do `telemetriaHttp`.

## Recomendação

Comece pela pergunta da seção B — **existe cadastro de associados com e-mail?** A resposta muda
completamente o tamanho do trabalho: com cadastro, é um adapter e uma chamada; sem cadastro,
é um estado novo na conversa, coleta de dado pessoal, atualização da política de privacidade e
todo o cuidado de entregabilidade.
