# Checklist de produção

Passos ordenados por prioridade. Os bloqueadores impedem o funcionamento do sistema — resolva-os antes de qualquer outra coisa.

---

## 🔴 Bloqueadores

### 1. Preencher as variáveis obrigatórias no `.env`

Sem essas três variáveis o serviço Python não inicializa em modo produção.

- [ ] Obter o **número de cliente** (cedente) da Assusa junto ao Sicoob
- [ ] Preencher `SICOOB_NUMERO_CLIENTE=<número>`
- [ ] Preencher `SICOOB_P12_PASSWORD=<senha do certificado .pfx>`
- [ ] Mudar `SICOOB_SANDBOX=false`
- [ ] Confirmar que o arquivo `certificados/certificado.pfx` é o certificado de **produção** (não sandbox)
- [ ] Confirmar que `SICOOB_CLIENT_ID` é o client ID de produção (o sandbox tem um diferente)

---

### 2. HTTPS com domínio público

A Meta só aceita webhook registrado em URL com HTTPS. Sem isso não chegam mensagens.

- [ ] Apontar um domínio (ex: `bot.assusa.com.br`) para o IP do servidor via DNS tipo A
- [ ] Adicionar um proxy reverso na frente do Node. Opções:
  - **Caddy** (recomendado — HTTPS automático via Let's Encrypt):
    ```
    bot.assusa.com.br {
        reverse_proxy web:8080
    }
    ```
  - **nginx** com certbot para gerar e renovar o certificado SSL
- [ ] Garantir que as portas 80 e 443 estão abertas no firewall do servidor
- [ ] Testar que `https://bot.assusa.com.br/` retorna `200` antes de registrar no painel Meta
- [ ] Atualizar a URL do webhook no painel do Meta Business para `https://bot.assusa.com.br/webhook`

---

### 3. Testar fluxo completo no sandbox antes de virar produção

Valida que o código funciona de ponta a ponta com dados reais antes de expor ao usuário final.

- [ ] Manter `SICOOB_SANDBOX=true` nesta etapa
- [ ] Usar um CPF real de teste com boletos em aberto no Sicoob sandbox
- [ ] Verificar no WhatsApp que a listagem de boletos retorna corretamente
- [ ] Selecionar um boleto e confirmar que o PDF chega no WhatsApp
- [ ] Verificar que a linha digitável e o PIX copia-e-cola estão corretos na mensagem
- [ ] Confirmar nos logs do Python que nenhum erro 4xx/5xx aparece durante o fluxo
- [ ] Confirmar que a tabela `interacoes` no PostgreSQL está sendo populada
- [ ] Somente após todos os passos acima passarem: mudar para `SICOOB_SANDBOX=false`

---

## 🟠 Segurança

### 4. Trocar o `WHATSAPP_VERIFY_TOKEN`

O token atual (`JoaoVitorVianaCientistaDeDados`) é previsível. Qualquer pessoa que conheça o padrão pode verificar o webhook.

- [ ] Gerar um token aleatório:
  ```bash
  openssl rand -hex 32
  ```
- [ ] Atualizar `WHATSAPP_VERIFY_TOKEN=<novo valor>` no `.env`
- [ ] Entrar no painel Meta Business → WhatsApp → Configuração → Webhook → Editar
- [ ] Substituir o "Token de verificação" pelo novo valor e salvar
- [ ] Reiniciar o container Node e confirmar que o webhook continua verificado

---

### 5. Trocar `POSTGRES_PASSWORD` e `INTERNAL_API_KEY`

Valores de desenvolvimento (`assusa-dev`, `docker-dev-internal-key`) não devem chegar ao servidor de produção.

- [ ] Gerar senha forte para o PostgreSQL:
  ```bash
  openssl rand -base64 32
  ```
- [ ] Atualizar `POSTGRES_PASSWORD=<novo valor>` no `.env`
- [ ] Gerar chave interna forte:
  ```bash
  openssl rand -hex 32
  ```
- [ ] Atualizar `INTERNAL_API_KEY=<novo valor>` no `.env` — **o mesmo valor deve aparecer tanto no Node quanto no Python**
- [ ] Se o banco já foi iniciado com a senha antiga: acessar o container e alterar via `ALTER USER assusa PASSWORD '...'`
- [ ] Reiniciar todos os containers e confirmar que a comunicação Node → Python continua funcionando (`/health`)

---

## 🟡 Qualidade funcional

### 6. Validação de CPF com algoritmo

Hoje só verifica se tem 11 dígitos — CPFs inválidos como `00000000000` ou `11111111111` passam e causam erros na API Sicoob.

- [ ] Implementar função `cpfValido(cpf)` em `services/conversation.js` com o algoritmo dos dois dígitos verificadores:
  1. Calcular primeiro dígito: soma dos 9 primeiros dígitos ponderados (10 a 2), resto por 11; se < 2 → 0, senão 11 − resto
  2. Calcular segundo dígito: soma dos 10 primeiros dígitos ponderados (11 a 2), mesma regra
  3. Comparar os dois dígitos calculados com os dois últimos do CPF
- [ ] Substituir a verificação de comprimento atual pela chamada a `cpfValido`
- [ ] Testar com CPFs válidos e inválidos conhecidos antes de subir

---

### 7. Formatar valor monetário e data no boleto

O campo `resultado.valor` chega cru da API (ex: `"150.50"`) e `resultado.dataVencimento` pode vir como `"2025-06-01"`. O usuário recebe isso sem formatação.

- [ ] Adicionar função de formatação de moeda em `services/conversation.js`:
  ```js
  function formatarBRL(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  ```
- [ ] Adicionar função de formatação de data:
  ```js
  function formatarData(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  ```
- [ ] Aplicar as funções na montagem de `caption` em `handleSelecaoBoleto` e nos botões de seleção (`Venc. ${b.dataVencimento}`)
- [ ] Testar com um boleto real no sandbox para confirmar a exibição

---

### 8. Tratar falha de conexão com Redis

Se o Redis reiniciar durante um fluxo ativo, `getEstado` retorna `null` e o usuário cai no menu principal sem aviso.

- [ ] Em `Conversation.handleMessage`, envolver a chamada `getEstado` em try/catch
- [ ] Em caso de erro de Redis: responder com `MSG_SEGUNDA_VIA_ERRO_SERVICO` e encerrar o fluxo
- [ ] Confirmar que o Redis tem `restart: unless-stopped` no docker-compose (já está, mas verificar)
- [ ] Opcionalmente configurar `maxmemory-policy allkeys-lru` no Redis para evitar travamento por falta de memória

---

## 🟢 Infraestrutura

### 9. Health check e restart policy para o Node no docker-compose

O serviço `web` não tem healthcheck — se o Node travar o container continua "up" e o Sicoob fica como dependência satisfeita mesmo sem o Node responder.

- [ ] Adicionar ao serviço `web` no `docker-compose.yml`:
  ```yaml
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:8080/', r => process.exit(r.statusCode === 200 ? 0 : 1))"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
  ```
- [ ] Testar que `docker compose ps` exibe `healthy` para o serviço `web` após subir

---

### 10. Limits de CPU e memória no docker-compose

Sem limites, um pico de mensagens pode consumir toda a memória do host e derrubar os outros containers.

- [ ] Adicionar limites ao `docker-compose.yml` para cada serviço. Valores sugeridos para um VPS com 2 GB de RAM:
  ```yaml
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 256M
  ```
  - `web` (Node): 256 MB
  - `sicoob` (Python): 256 MB
  - `redis`: 128 MB
  - `postgres`: 512 MB
- [ ] Ajustar os valores de acordo com o uso real observado nos primeiros dias em produção

---

### 11. Backup automático do PostgreSQL

A tabela `interacoes` é o histórico de atendimentos. Sem backup, uma falha de disco apaga tudo.

- [ ] Criar script de dump periódico no servidor host:
  ```bash
  #!/bin/bash
  docker exec <container_postgres> pg_dump -U assusa assusa \
    | gzip > /backups/assusa_$(date +%Y%m%d_%H%M).sql.gz
  find /backups -name "*.sql.gz" -mtime +7 -delete
  ```
- [ ] Registrar o script no cron do host (ex: todo dia às 3h):
  ```
  0 3 * * * /opt/scripts/backup_postgres.sh
  ```
- [ ] Criar a pasta `/backups` com permissões adequadas
- [ ] Testar o restore do backup manualmente antes de ir a produção:
  ```bash
  gunzip -c backup.sql.gz | docker exec -i <container_postgres> psql -U assusa assusa
  ```
- [ ] Opcionalmente copiar os backups para armazenamento remoto (S3, Backblaze, etc.)

---

### 12. Verificar expiração do `ACCESS_TOKEN` do WhatsApp

O token atual no `.env` pode ser temporário (24h ou 60 dias). Se expirar em produção, todas as mensagens param de ser enviadas silenciosamente.

- [ ] Acessar o painel Meta Business → WhatsApp → Contas de API → verificar o tipo do token
- [ ] Se for token temporário: gerar um **token de sistema permanente** em Meta Business → Configurações → Usuários do sistema
- [ ] Atualizar `ACCESS_TOKEN=<token permanente>` no `.env`
- [ ] Configurar um alerta (email ou webhook) no Meta Business para notificar se o token for revogado
- [ ] Confirmar que `APP_SECRET` e `APP_ID` também correspondem ao app de produção (não ao app de desenvolvimento)
