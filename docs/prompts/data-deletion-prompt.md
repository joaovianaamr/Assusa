Você é o Claude Agent trabalhando no projeto:

/home/joaovianaamr/dev/project/segunda-via-wpp-assusa

Tarefa: implementar a exclusão real de dados do usuário a partir da página pública `public/data-deletion.html`.

Contexto atual:
- A página `public/data-deletion.html` envia `POST /data-deletion` com JSON:
  - `phone`
  - `cpf`
  - `email` opcional
- Hoje a rota em `app.js` só faz `console.log` e responde sucesso.
- Há um TODO no `app.js` indicando: remover do Postgres e encerrar sessão Redis.
- O Redis guarda estado por telefone nas chaves:
  - `estado:<telefone>`
  - `boletos:<telefone>`
- As interações persistentes ficam no Postgres via microsserviço Python, na tabela `interacoes`, definida em:
  - `python/sicoob_service/src/sicoob_service/database.py`
- O Node registra interações chamando o microsserviço Python por `services/interacaoClient.js`.
- O microsserviço Python já tem rotas internas:
  - `POST /interno/interacao`
  - `GET /interno/interacoes`

Objetivo:
Implementar `POST /data-deletion` para realmente excluir os dados associados ao telefone e CPF informados pelo usuário, removendo registros persistidos no Postgres e limpando a sessão/cache no Redis.

Requisitos funcionais:
1. No Node (`app.js`), trocar o stub atual de `POST /data-deletion` por uma implementação real.
2. Validar entrada:
   - `phone` obrigatório.
   - `cpf` obrigatório.
   - normalizar ambos removendo caracteres não numéricos.
   - aceitar telefone com DDD sem país e telefone com código do Brasil.
   - aceitar CPF com ou sem pontuação.
   - rejeitar CPF inválido com HTTP 400.
3. Limpar Redis para as variações relevantes do telefone:
   - telefone como recebido normalizado.
   - telefone com prefixo `55`, quando o usuário informou apenas DDD+número.
   - telefone sem prefixo `55`, quando o usuário informou `55` + DDD+número.
   - limpar `estado:<telefone>` e `boletos:<telefone>` para cada variação.
4. Criar no `services/redis.js` um método claro para exclusão de dados de usuário, por exemplo `clearUserData(phoneNumbers)`, sem quebrar os métodos existentes.
5. Criar no Node um cliente interno para solicitar ao microsserviço Python a exclusão no Postgres.
   - Pode ser adicionado ao `services/interacaoClient.js` ou a um novo serviço pequeno, seguindo o padrão atual de `SICOOB_SERVICE_URL` e `INTERNAL_API_KEY`.
   - A chamada deve aguardar resposta e propagar erro se o microsserviço falhar.
6. No Python, adicionar uma rota interna autenticada para exclusão, por exemplo:
   - `DELETE /interno/interacoes`
   - corpo JSON ou query params com `telefone` e `cpf`.
   - usar a dependência `AuthDep`, como as rotas internas existentes.
7. No `database.py`, adicionar função de exclusão que remova registros da tabela `interacoes` associados ao usuário.
   - Excluir registros em que `telefone` esteja entre as variações normalizadas do telefone.
   - Excluir também registros em que `cpf` seja igual ao CPF normalizado.
   - Retornar a quantidade de linhas removidas.
8. A resposta de `POST /data-deletion` deve ser JSON e indicar sucesso real:
   - `status: "deleted"`
   - quantidade de registros removidos do Postgres.
   - quantidade de chaves Redis removidas.
9. A página `public/data-deletion.html` não deve mostrar sucesso incondicional se a API falhar.
   - Se `POST /data-deletion` retornar erro ou falhar, manter o formulário visível e mostrar mensagem de erro simples.
   - Se retornar sucesso, esconder formulário e mostrar a mensagem atual de sucesso.
10. Não apagar dados externos no Sicoob nem chamar APIs bancárias. A exclusão é apenas dos dados mantidos por este sistema: Redis e tabela `interacoes`.

Cuidados de segurança e LGPD:
- Não logar CPF completo nem telefone completo em produção.
- Se precisar logar, mascarar valores.
- Não retornar detalhes sensíveis na resposta.
- Não transformar essa rota em endpoint administrativo aberto para consultar dados.
- Manter autenticação interna apenas entre Node e Python; a página pública continua chamando apenas o Node.

Testes obrigatórios:
1. Testes Node:
   - `POST /data-deletion` com CPF inválido retorna 400.
   - `POST /data-deletion` válido chama limpeza de Redis e exclusão no microsserviço.
   - erro do microsserviço retorna HTTP 500 ou 502, sem sucesso falso.
2. Testes Python:
   - rota interna de exclusão chama `database.excluir...` com telefone/CPF normalizados.
   - rota exige header interno correto, seguindo o padrão já existente.
   - função de banco executa `DELETE` e retorna contagem.
3. Teste/manual ou automatizado da página:
   - sucesso só aparece quando a API retorna OK.
   - falha mostra erro e mantém formulário.

Comandos de verificação esperados:
- `npm test`
- Testes Python do microsserviço, conforme o padrão do projeto, por exemplo:
  - `cd python/sicoob_service && pytest`

Critério de conclusão:
- A rota pública `POST /data-deletion` deixa de ser apenas registro em console.
- Dados do usuário são removidos do Redis e do Postgres.
- A página pública reflete erro/sucesso corretamente.
- Testes cobrem o fluxo principal e falhas.
