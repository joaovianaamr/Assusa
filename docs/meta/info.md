
* **App ID:** 3022736628114151
* **Business ID:** 1269589111675253

Id do numero teste: 1170317646154505

id no painel: 2243287776413548

![1784840038806](image/info/1784840038806.png)

![1784840330689](image/info/1784840330689.png)

# para waba  "Assusa" -> tem numero real

* id: 368840660673690
* pin:  000000
* phone number id: 3009766265732489

![1784840660206](image/info/1784840660206.png)

![1784840737211](image/info/1784840737211.png)



# Para conta WABA -> tem numero de teste

id conta: 2243287776413548

![1784841155896](image/info/1784841155896.png)

![1784841170385](image/info/1784841170385.png)

# ![1784841217542](image/info/1784841217542.png) Números cadastrados

![1784843138111](image/info/1784843138111.png)

obs.: o whatsapp da erro se eu colocar o '9' padrão antes tem que ser só 8 números

# Contas

![1784843920322](image/info/1784843920322.png)

![1784843934980](image/info/1784843934980.png)

# Pistas para o próximo passo

![1784844557059](image/info/1784844557059.png)

![1784844567063](image/info/1784844567063.png)

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
