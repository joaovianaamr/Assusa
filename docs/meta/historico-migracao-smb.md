# Histórico — migração SMB → Cloud API (número fixo)

> Registro cronológico da investigação de jul/2026 sobre o `+55 31 3624-8550`.
> **Não é guia de uso.** Para cadastrar um número novo, ver [playbook-numero-novo.md](playbook-numero-novo.md);
> para IDs e estado atual, ver [referencia.md](referencia.md).
>
> Valor deste documento: mostra *como* diagnosticar quando a Meta devolve erro enganoso —
> a tabela de diagnósticos falsos no fim é o resumo mais reaproveitável.

# Migração do número real (+55 31 3624-8550) para a Cloud API

## Diagnóstico

O número `+55 31 3624-8550` está cadastrado na WABA **"Assusa"** (id `368840660673690`,
phone number id `3009766265732489`), mas hoje ele é do tipo **"Aplicativo WhatsApp
Business"** (SMB) — ou seja, é o app comum de celular/desktop, não um número nativo da
Cloud API. Por isso ele aparece como **Offline** na aba "Phone numbers".

Tentativa de registrar direto na Cloud API (o mesmo passo que funciona para o número de
teste) **falhou**:

```
POST https://graph.facebook.com/v23.0/3009766265732489/register
{ "messaging_product": "whatsapp", "pin": "000000" }

Resposta:
{
  "error": {
    "message": "Register endpoint is not available for SMB businesses.",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "A35IOeSiHQy6AtYHGHOD4Vh"
  }
}
```

Isso confirma: números do app SMB precisam passar por uma **migração** antes de virarem
utilizáveis pela Cloud API — não dá pra simplesmente chamar `/register`.

## Caminho de migração (achado no painel)

No WhatsApp Manager, dentro de **Configuração da API** (menu lateral), existe a opção
**"Migrar clientes"** — é o fluxo oficial pra mover um número do app WhatsApp Business
para a Cloud API.

Ao iniciar a migração para a conta "Assusa", apareceu o modal **"Vincular conta do
WhatsApp Business"**:

> A verification code was sent to your WhatsApp Business App for +55 (31) 3624-8550.
> Enter it here to finish adding your WhatsApp account.

Ou seja, o código de verificação é enviado **dentro do próprio app WhatsApp Business**
já instalado no celular/computador que usa esse número — não por SMS/ligação.

### Passo a passo

1. WhatsApp Manager → conta **"Assusa"** → **Configuração da API** → **Migrar clientes**
2. Selecionar o número `+55 31 3624-8550`
3. **Atenção:** quem tiver o WhatsApp Business App logado com esse número vai receber o
   código de verificação por lá — precisa ter acesso a esse app no momento da migração.
   Confirmar com o time se alguém ainda atende clientes por esse número no app antes de
   migrar, pois a migração desconecta o número do app comum.
4. Inserir o código de 5 dígitos recebido no app → **Continuar**
5. Depois de migrado, repetir o `POST /{phone-number-id}/register` com o PIN (`000000`)
   — aí sim deve funcionar, já que o número deixa de ser "SMB" e passa a ser Cloud API
6. Confirmar que o status na aba "Phone numbers" da WABA "Assusa" muda de **Offline**
   para **Conectado**
7. Como o bot lê o `phone_number_id` dinamicamente do payload do webhook
   (`app.js:112`), nenhuma mudança de código é necessária — assim que o número estiver
   ativo na Cloud API, o bot já responde por ele.

# Caminho para migração

![1784898569737](../capturas/meta/info/1784898569737.png)

# Verifica o nùmero de telefone

curl -X POST
  'https://graph.facebook.com/v25.0/3009766265732489/request_code'
  -H 'Authorization: Bearer $ACCESS_TOKEN'
  -H 'Content-Type: application/json'
  -d '{
    "code_method": "SMS",
    "language": "en_US"
  }'

pode ser "SMS" ou "VOICE"

## IMPORTANTE: são dois fluxos de verificação diferentes

Não confundir — foi fonte de diagnóstico errado em 26/07/2026:

**Fluxo A — migração pelo painel** ("Migrar clientes" / "Vincular conta do WhatsApp Business").
O código (5 dígitos) chega como **mensagem dentro do próprio WhatsApp Business**, enviada pela
conta oficial do WhatsApp. Não passa por SMS nem por operadora. Funciona em linha fixa. Aparece
também no WhatsApp Web vinculado. **É o fluxo correto para este número.**

**Fluxo B — `request_code` da Cloud API** (`code_method: SMS | VOICE`). Telefonia pura.

### O número é FIXO, não celular

`+55 31 3624-8550` — 8 dígitos começando com `3`, DDD 31 = linha fixa de BH. É por isso que o
WhatsApp dá erro se colocar o `9` na frente (o `9` é prefixo de celular).

Consequência **apenas para o fluxo B**: linha fixa não recebe SMS, então `code_method: "SMS"`
nunca vai funcionar neste número. Se um dia for necessário usar o fluxo B, tem que ser `"VOICE"`
(ligação automática que fala o código), com alguém ao lado do aparelho na empresa para atender.

O fluxo A não tem essa limitação.

**Testado em 24/07/2026 — resultado:**

```json
{
  "error": {
    "message": "Request code error",
    "type": "OAuthException",
    "code": 136024,
    "error_subcode": 2388367,
    "error_user_title": "Solicitar limite de volume do código",
    "error_user_msg": "Você pediu um código de verificação muitas vezes. Tente novamente mais tarde."
  }
}
```

Rate limit da Meta — é por isso que o código de verificação nunca chega (nem por SMS/voz nem no
app). Não é problema de notificação/app fechado/sessão expirada. Precisa esperar o cooldown
passar (algumas horas até ~24-48h) e evitar pedir código de novo nesse meio tempo, senão o
cooldown pode resetar.

**Retestado em 26/07/2026 (SMS, uma única tentativa) — resultado:**

```json
{
  "error": {
    "message": "Request code error",
    "type": "OAuthException",
    "code": 136024,
    "error_subcode": 2388091,
    "is_transient": false,
    "error_user_title": "Não foi possível enviar o código",
    "error_user_msg": "Falha no código do pedido: Nossos servidores estão temporariamente indisponíveis. Aguarde 1 hour antes de tentar novamente."
  }
}
```

`error_subcode` mudou de `2388367` (limite de volume, cooldown longo) para `2388091` (cooldown
curto de 1h). Leitura provável: o bloqueio de 24-48h expirou e restou só a janela curta. Leitura
alternativa, não descartável sem gastar tentativa: os dois limitadores são independentes e o de
1h foi atingido primeiro, com o de volume ainda ativo por baixo.

**Retestado em 27/07/2026 com `code_method: "VOICE"` — resultado idêntico:**

```json
{
  "error": {
    "message": "Request code error",
    "type": "OAuthException",
    "code": 136024,
    "error_subcode": 2388091,
    "is_transient": false,
    "error_user_title": "Não foi possível enviar o código",
    "error_user_msg": "Falha no código do pedido: Nossos servidores estão temporariamente indisponíveis. Aguarde 1 hour antes de tentar novamente."
  }
}
```

Mesmo subcode do dia anterior, **mais de 24h depois**. Duas conclusões:

1. **Não é cooldown de 1h.** Se fosse, teria expirado. A mensagem "aguarde 1 hour" é falsa.
2. **Não é telefonia.** `VOICE` falha igual a `SMS`, então a limitação de linha fixa não explica
   este erro — o pedido nem chega à camada de envio.

Leitura mais provável agora: `request_code` **não está disponível para número `ON_PREMISE`/SMB**, e
a Meta reporta essa condição como indisponibilidade temporária de servidor. É o mesmo padrão
enganoso do `Missing Permission` no `/register` — erro estrutural mascarado de erro transitório.

Ressalva: só se sustenta se ninguém disparou código pelo painel entre 26 e 27/07. Se alguém
clicou, o cooldown pode ter sido renovado e a leitura de rate limit volta a valer.

**Consequência:** parar de gastar tentativas no fluxo B. Ele provavelmente nunca vai funcionar
enquanto `platform_type` for `ON_PREMISE`. O caminho é o fluxo A (painel → Migrar clientes).

### Painel e API parecem compartilhar o mesmo limitador

Verificado em 26/07/2026: **não existe nenhum código na conversa oficial do WhatsApp** (nem
antigo/expirado, nem arquivado). Se o fluxo A do painel tivesse enviado de verdade em alguma das
tentativas anteriores, haveria rastro.

Conclusão: os disparos do painel também estavam sendo bloqueados. O modal do painel mostra
*"A verification code was sent to your WhatsApp Business App"* de forma otimista, **sem checar se
o envio saiu** — diferente da API, que devolve o erro real. Ou seja, cliques no painel que
"não deram nada" foram tentativas contabilizadas, e provavelmente é isso que estourou o limite
de volume logo no início.

**Regra operacional:** tratar painel e API como o mesmo contador. Qualquer disparo, de qualquer
canal, pode resetar o cooldown. O caminho mais barato é **não tentar nada** por um bloco folgado
(~24h desde a última tentativa, não a "1 hora" anunciada, porque o limite de volume por baixo é
invisível), e então fazer **uma única** tentativa pelo fluxo A, com o WhatsApp Web aberto e
alguém de olho no celular da empresa.

Estado do número no momento do teste (`GET /{phone-number-id}`):

```json
{
  "display_phone_number": "+55 31 3624-8550",
  "verified_name": "Assusa",
  "code_verification_status": "NOT_VERIFIED",
  "quality_rating": "UNKNOWN",
  "platform_type": "ON_PREMISE",
  "status": "DISCONNECTED"
}
```

O token atual **lê** o número sem erro — o `Missing Permission` do `register` é de escopo de
escrita (`whatsapp_business_management`), não de acesso à WABA.

# Registrar telefone na API de nuvem do whatsapp

curl -X POST
  'https://graph.facebook.com/v25.0/3009766265732489/register'
  -H 'Authorization: Bearer $ACCESS_TOKEN'
  -H 'Content-Type: application/json'
  -d '{
    "messaging_product": "whatsapp",
    "pin": "000000",
    "tier": "prod"
  }'

**Testado em 24/07/2026 — resultado:**

```json
{"error":{"message":"(#100) Missing Permission","type":"OAuthException","code":100}}
```

Diferente do erro anterior ("Register endpoint is not available for SMB businesses") — agora é
"Missing Permission".

**Investigado em 26/07/2026 — não é problema de token.** Descartado por teste direto:

```
GET /debug_token
→ type: SYSTEM_USER, is_valid: true, expires_at: 0 (não expira)
→ scopes: whatsapp_business_management, whatsapp_business_messaging,
          manage_app_solution, whatsapp_business_manage_events, public_profile

GET /368840660673690 (WABA Assusa)
→ account_review_status: APPROVED, business_verification_status: verified

GET /368840660673690/phone_numbers
→ lista o +55 31 3624-8550
```

Os dois GETs na WABA só funcionam se o usuário do sistema estiver atribuído a ela como ativo —
logo, atribuição de ativo e escopo estão OK. A hipótese de "faltou `whatsapp_business_management`"
está **descartada**.

**Causa real: `platform_type: ON_PREMISE`.** O `/register` da Cloud API só é válido para número
já na plataforma Cloud API. Esse número ainda é do app WhatsApp Business (SMB), e a primeira
tentativa já dizia isso claramente ("Register endpoint is not available for SMB businesses"). O
`Missing Permission` é a mesma condição relatada de forma enganosa pela Meta — ambos são
`code: 100`.

**Consequência prática:** `register` não é o passo atual. A ordem correta é migrar o número de
SMB → Cloud API primeiro (o `request_code` faz parte dessa verificação); o `register` só passa a
fazer sentido depois que `platform_type` deixar de ser `ON_PREMISE`. O único bloqueio ativo hoje
é o rate limit do `request_code`.

# Verificação de número (aba -> ativos de negócios)

![1784902186477](../capturas/meta/info/1784902186477.png)

Para ativar o número e mudar o status para  **Online** , siga estes passos:

* **Acesse as ****Configurações do Negócio** e vá em  **Contas do WhatsApp** **.**
* **Selecione a conta ** **Assusa Aplicativo WhatsApp Business** **.**
* **Clique na aba ****Linked phone numbers** (Números de telefone vinculados).
* **Procure o botão para ****Verificar** ou **Concluir configuração** ao lado do número.
* **Escolha o método de recebimento do código (SMS ou Chamada de voz) e insira o código de 6 dígitos recebido.**

**Importante:**
 Notei também que não há uma forma de pagamento configurada na sua conta
 do WhatsApp. Após a verificação, você precisará adicionar um método de
pagamento nas configurações de cobrança do seu Gerenciador de Negócios
para garantir que os limites de mensagens sejam liberados.

Você conseguiu localizar a opção para verificar o número?

## tempo

**A verificação do número de telefone no WhatsApp Business costuma ser ** **imediata** **.**

**Assim que você solicita o código por SMS ou chamada de voz e o insere no painel de configurações, o status do número deve mudar de ****Não verificado** para **Conectado** instantaneamente.

**No entanto, existem alguns prazos importantes para as etapas seguintes:**

* **Sincronização com o Inbox:** Após a verificação, pode levar até **24 horas** para que o número apareça totalmente ativo e pronto para uso dentro da aba de mensagens (Inbox) do Meta Business Suite.
* **Análise do Nome de Exibição:** Se você alterou o nome que aparece para os clientes ("Assusa"), a análise da Meta para aprovar esse nome pode levar de  **algumas horas até 3 dias úteis** **. Enquanto o nome é analisado, você já pode enviar mensagens, mas o nome ainda não aparecerá para todos os contatos.**

**Dica:** Se o código de verificação não chegar em 5 minutos, tente a opção de  **Chamada de voz** **, que costuma ser mais rápida em casos de instabilidade com SMS.**

**Você já tentou solicitar o código agora? Se encontrar algum erro durante o processo, me avise para que possamos investigar.**

### rate limit

**Aqui está o que você precisa saber para resolver isso:**

* **Tempo de Espera:** O "Rate Limit" geralmente exige uma espera de **12 a 24 horas** a partir da sua última tentativa. Tentar solicitar um novo código antes desse prazo pode reiniciar o temporizador de bloqueio.
* **A Opção de Chamada:** Quando o tempo de espera expirar, recomendo que tente a opção **"Me ligue" (Call me)** em vez de SMS. Muitas vezes, operadoras de telefonia bloqueiam SMS de códigos internacionais, e a chamada de voz costuma ser mais confiável.
* **Verificação de Operadora:** Se após 24 horas o código ainda não chegar por nenhuma das opções, recomendo entrar em contato com sua operadora para verificar se há algum bloqueio para recebimento de chamadas ou SMS de sistemas automáticos (Short Codes).

**Minha recomendação agora:**
Aguarde um período completo de **24 horas** sem tentar novas solicitações. Amanhã, tente novamente utilizando a opção de chamada de voz.

**Há algo mais em que eu possa ajudar enquanto aguardamos esse prazo?**


# Escopo do token:

![1785081947305](../capturas/meta/info/1785081947305.png)

## 27/07/2026 — "esse número não está atrelado à sua conta" (IA da Meta) é FALSO

Terceiro diagnóstico enganoso vindo da Meta neste mesmo caso. Verificado por Graph API:

```
GET /368840660673690 (WABA "Assusa")
→ ownership_type: SELF
→ owner_business_info: { id: 1269589111675253, name: "Assusa" }
→ on_behalf_of_business_info: { id: 1269589111675253, status: APPROVED, type: SELF }
→ business_verification_status: verified, account_review_status: APPROVED

GET /368840660673690/phone_numbers
→ [{ display_phone_number: "+55 31 3624-8550", id: "3009766265732489",
     platform_type: ON_PREMISE, status: DISCONNECTED,
     code_verification_status: NOT_VERIFIED }]

GET /debug_token
→ type: SYSTEM_USER, application: "Assusa" (app 3022736628114151),
  is_valid: true, expires_at: 0
```

Cadeia de propriedade completa e íntegra: número → WABA "Assusa" → Business "Assusa"
(`1269589111675253`). Sem BSP intermediário.

**O que a IA confundiu:** *vinculado à conta* (verdadeiro) com *registrado na Cloud API*
(falso — `platform_type` ainda é `ON_PREMISE`). São estados independentes.

Ressalva do teste: `/owned_whatsapp_business_accounts` e `/client_whatsapp_business_accounts`
retornaram `(#200) Requires business_management permission`. É escopo ausente no system user
token (esperado), não sinal de desvínculo — a consulta direta à WABA já é conclusiva.

**Não altera o plano.** Fluxo B segue descartado; caminho continua fluxo A (painel →
Configuração da API → Migrar clientes), uma única tentativa.

**Padrão acumulado — desconfiar de diagnóstico da Meta sem verificação por API:**

| Alegação da Meta | Realidade |
|---|---|
| `/register` → "Missing Permission" | Token e escopos OK; causa é `platform_type: ON_PREMISE` |
| `request_code` → "servidores indisponíveis, aguarde 1 hour" | Persistiu >24h; provavelmente indisponível para SMB |
| IA: "código de 6 dígitos por SMS/voz, verifique com a operadora" | Fluxo A usa 5 dígitos dentro do app; número é linha fixa |
| IA: "número não atrelado à sua conta" | Vínculo íntegro e verificado acima |

## 27/07/2026 — número novo (+55 31 98427-1278) e o limite de BSP

Comprado chip pré-pago virgem para contornar o impasse do fixo. Confirmado limpo:
`wa.me` e lista de contatos mostram apenas "Convidar", sem conta WhatsApp ativa.

Tentativa de cadastrar por API **falhou**:

```
POST /368840660673690/phone_numbers
{ "cc": "55", "phone_number": "31984271278", "verified_name": "Assusa" }

→ { "code": 200000, "error_subcode": 3095008,
    "message": "Cannot add phone number to WhatsApp Business Account" }
```

**Causa real**, exposta ao consultar campos restritos da mesma WABA:

```
GET /368840660673690?fields=...,primary_funding_id,...
→ (#10) You do not have permission to perform this action. This action requires that
  the Business that owns this App is a Business Solution Provider for WhatsApp.
```

`POST /{waba-id}/phone_numbers` é operação de **Solution Partner / Tech Provider**. O app
"Assusa" é um negócio direto, não BSP — logo esse endpoint nunca vai funcionar aqui. O
`200000/3095008` é a mesma condição relatada sem explicação.

**Não consumiu tentativa de código.** A falha ocorre antes de qualquer envio; o rate limit
do número novo segue zerado.

**Evidência de que o resto do fluxo funciona nesta conta:** a WABA `Waba-test`
(`2243287776413548`) tem `+1 555-647-1004` com `platform_type: CLOUD_API` e
`status: CONNECTED` — criado pelo painel.

**Caminho correto:** WhatsApp Manager → conta Assusa → Números de telefone → Adicionar
número de telefone → SMS (é celular, funciona) → código de 6 dígitos. Nunca instalar
WhatsApp no chip, sob pena de repetir o beco sem saída `ON_PREMISE` do fixo.

Depois disso, `scripts/meta-numero.sh` cobre `listar` / `registrar` / `status`.

## 27/07/2026 — tentativa de cadastro pelo painel (ver cadastro.md)

**Fluxo errado usado:** Configurações do Negócio → Contas do WhatsApp → Adicionar →
*"Vincular uma conta do WhatsApp Business"*. Resultado esperado e correto:

> Please double check that this phone number is registered on a WhatsApp Business app account.

"Vincular" é o fluxo A (migração SMB) e exige conta prévia no app. O 31 98427-1278 é
virgem, logo é recusado. Falha na validação do modal, **sem consumir tentativa de código**.

**Descoberta relevante — a WABA "Assusa" é SMB.** O painel a rotula como
*"Aplicativo WhatsApp Business"* logo abaixo de "Propriedade de: Assusa". Explica por que
ela hospeda o fixo em `ON_PREMISE` e por que provavelmente não oferece adição de número
Cloud API. A `Waba-test` (`2243287776413548`) é nativa Cloud API e hospeda
`+1 555-647-1004` em `CLOUD_API`/`CONNECTED`.

**Caminho correto:** Adicionar → *"Crie uma nova conta do WhatsApp Business"* (WABA nativa
Cloud API, sugestão de nome `Assusa Cloud API`) → dentro dela, adicionar o número com
verificação por SMS. O nome de WABA é interno; o cliente vê o `verified_name` (`Assusa`).

**Correção:** a alegação da IA da Meta de que faltava forma de pagamento é **falsa**. O
painel mostra `MASTERCARD *8089, expira em 5/2036`, Business `Verificado`, conta `Aprovada`.
Quinto diagnóstico incorreto vindo da Meta neste caso.

## 27/07/2026 — RESOLVIDO: número novo ativo na Cloud API

WABA nova criada pelo painel (Adicionar → "Crie uma nova conta do WhatsApp Business"),
o número virgem entrou nela e ficou operacional na primeira tentativa.

| Ativo | Valor |
|---|---|
| WABA | `2109652016644520` ("Assusa") — `SELF`, `APPROVED`, business `verified` |
| Número | `+55 31 98427-1278` (a Meta exibe sem o `9`: `+55 31 8427-1278`) |
| `phone_number_id` | `1164007100138609` |
| Estado | `platform_type: CLOUD_API`, `status: CONNECTED`, `code_verification_status: VERIFIED` |
| Nome de exibição | `Assusa` — `name_status: APPROVED` |

**Por que funcionou onde o fixo travou:** número nunca teve WhatsApp, então entrou direto
como `CLOUD_API` em vez de `ON_PREMISE`. Verificação por SMS funcionou de primeira (é
celular). Nenhum rate limit encontrado.

**Passo que o painel não faz sozinho:** a WABA nova nasce com `subscribed_apps` vazio —
sem isso o webhook nunca recebe evento. Corrigido por API:

```
POST /2109652016644520/subscribed_apps → { "success": true }
```

Estado final da integração, verificado:

```
GET /{app-id}/subscriptions
→ whatsapp_business_account -> https://assusa.tech/webhook | active: true
  (inclui o campo `messages`)

GET https://assusa.tech/ → 200
```

Nenhuma mudança de código foi necessária: o bot lê o `phone_number_id` do payload
(`app.js:112`).

**Pendência do número fixo (+55 31 3624-8550):** segue `ON_PREMISE`/`DISCONNECTED` na WABA
antiga `368840660673690`. Não é mais bloqueio para operar — decidir depois se migra ou
descarta.

---

# Apêndice — levantamento inicial (prints originais)

Conteúdo original do topo do antigo `info.md`, preservado pelos prints do painel. Os IDs foram
consolidados e reconferidos em [referencia.md](referencia.md); aqui ficam as capturas e as
observações feitas na hora.

## Visão geral do app

![](../capturas/meta/info/1784840038806.png)

![](../capturas/meta/info/1784840330689.png)

## WABA "Assusa" (número real)

* pin: `000000`
* phone number id: `3009766265732489`

![](../capturas/meta/info/1784840660206.png)

![](../capturas/meta/info/1784840737211.png)

## WABA de teste (`2243287776413548`)

![](../capturas/meta/info/1784841155896.png)

![](../capturas/meta/info/1784841170385.png)

## Números cadastrados

![](../capturas/meta/info/1784841217542.png)

![](../capturas/meta/info/1784843138111.png)

> obs.: o whatsapp da erro se eu colocar o '9' padrão antes tem que ser só 8 números
> — confirmado depois: é linha fixa, ver [referencia.md](referencia.md).

## Contas

![](../capturas/meta/info/1784843920322.png)

![](../capturas/meta/info/1784843934980.png)

## Pistas para o próximo passo

![](../capturas/meta/info/1784844557059.png)

![](../capturas/meta/info/1784844567063.png)

## Prints sem contexto registrado

Ficaram órfãos no `info.md` original; mantidos porque podem ser úteis.

![](../capturas/meta/info/1784840744309.png)

![](../capturas/meta/info/1784842479587.png)

![](../capturas/meta/permissoes/public_profile.png)
