# bot-assusa-wpp

bot-assusa-wpp is based on the WhatsApp Business Platform sample experience and adapted for the ASSUSA second-copy flow. Using this demo as inspiration, you can create a delightful WhatsApp experience that leverages both automation and live customer support.

[Access the WhatsApp experience](https://wa.me/15558813169?text=Get+started)

See the [Developer Documentation on this experience](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview).

# Setting up your WhatsApp App

## Requirements

- **Meta Developer Account:** Required to create new apps, which are the core of any Meta integration. You can create a new developer account by going to the [Meta Developers website](https://developers.facebook.com/) and clicking the "Get Started" button.
- **Meta App:** Contains the settings for your WhatsApp automation, including access tokens. To create a new app, visit your [app dashboard](https://developers.facebook.com/apps).
- **Meta Business:** This is a pre-requisite for building with WhatsApp. If you don't have a business, you can create one in the app creation flow.
- **WhatsApp Business Account:** This is needed to send and receive messages in WhatsApp. To create a new WhatsApp Business account, visit [Meta Business Suite](https://business.facebook.com/latest).

## Setup Steps

Before you begin, make sure you have completed all of the requirements listed above. At this point you should have a Business and a registered Meta App.

#### Get the App id, App Secret, App Token, and Waba id

1. Go to your app Basic Settings, [Find your app here](https://developers.facebook.com/apps)
2. Save the **App ID** number and the **App Secret**
3. Go to your Business in Meta Business Suite and find your desired WhatsApp Business Account under the WhatsApp tab.
4. Save the **Waba ID**
5. Create a system user token for your app. Save this **App token**. [Find instructions here](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login)

#### Grant WhatsApp access to your developer app

1. Go to your app Dashboard
2. Under _Add Product_ find _WhatsApp_ and click _Set Up_
3. Now you should be in the App's WhatsApp Settings.
4. Navigate to the _Configuration_ tab.

# Installation

Clone this repository on your local machine:

```bash
$ git clone git@github.com:<seu-usuario>/bot-assusa-wpp.git
$ cd bot-assusa-wpp
```

You will need:

- [Node](https://nodejs.org/en/) 10.x or higher
- Remote server service, a local tunneling service such as [ngrok](https://ngrok.com/), or your own webserver.
- Opcional: [Python](https://www.python.org/) 3.11+ para o microsserviço de **boletos Sicoob** (`python/sicoob_service`). O Node chama este serviço por HTTP quando `SICOOB_SERVICE_URL` e `INTERNAL_API_KEY` estão definidos (ver `.sample.env` e `python/sicoob_service/README.md`).
- Documentação de contexto, guias e ficheiros do template Meta: pasta [docs/meta/](docs/meta/) (índice em [docs/meta/README.md](docs/meta/README.md)).

# Usage

## Using ngrok

#### 1. Setup templates
In order for the app to send templated messages, you need to first create those templates under your WhatsApp Business Account. You can either do this by running `./docs/meta/template.sh` or through [WhatsApp Manager](https://business.facebook.com/latest/whatsapp_manager/message_templates).

#### 2. Install Redis
If not already installed, install redis via [download](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/).

You can then start a redis daemon locally via command line:

```bash
redis-server --daemonize yes
```

#### 3. Install tunneling service

If not already installed, install ngrok via [download](https://ngrok.com/download) or via command line:

```bash
npm install -g ngrok
```

In the directory of this repo, request a tunnel to your local server with your preferred port
```bash
ngrok http 8080
```

The screen should show the ngrok status:

```
Session Status                online
Account                       Redacted (Plan: Free)
Version                       2.3.35
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://1c3b838deacb.ngrok.io -> http://localhost:3000
Forwarding                    https://1c3b838deacb.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```
Note the https URL of the external server that is forwarded to your local machine. In the above example, it is `https://1c3b838deacb.ngrok.io`.

#### 4. Install the dependencies

Open a new terminal tab, also in the repo directory.

```bash
$ npm install
```

Alternatively, you can use [Yarn](https://yarnpkg.com/en/):

```bash
$ yarn install
```

#### 5. Set up .env file

Copy the file `.sample.env` to `.env`

```bash
cp .sample.env .env
```

Edit the `.env` file to add all the saved secrets. Note that `VERIFY_TOKEN` will be a passphrase you create that will handshake your app with webhook subscription process.

#### 6. Run your app locally

```bash
node app.js
```

#### 7. Configure your webhook subscription

Use the `VERIFY_TOKEN` that you created in `.env` file and subscribe your webhook server's URL for WhatsApp webhooks in your developer page's _Configuration_ tab. Make sure to subscribe to the messages field. Note that the app listens to webhooks on the `/webhook` endpoint.

#### 8. Test that your app setup is successful

Send a message to your WhatsApp Business Account from a consumer WhatsApp number.

You should see the webhook called in the ngrok terminal tab, and in your application terminal tab.

If you see a response to your message in WhatsApp, you have fully set up your app! Voilà!

## Deploy

Todo push em `main` roda testes automaticamente e, se passar, faz deploy sozinho na VPS
de produção. Fluxo completo, secrets e troubleshooting: [docs/deploy.md](docs/deploy.md).
Checklist de produção: [docs/PRODUCAO.md](docs/PRODUCAO.md).

## License

This project includes code derived from the Jasper's Market sample, which is Apache 2.0 licensed, as found in the LICENSE file.

See [CONTRIBUTING](docs/meta/CONTRIBUTING.md) for how to help out. Contexto do produto (ASSUSA / Sicoob): [docs/meta/project-context.md](docs/meta/project-context.md).

Terms of Use - https://opensource.facebook.com/legal/terms
Privacy Policy - https://opensource.facebook.com/legal/privacy
