# Landing Page - Instruções de Publicação

Este documento contém instruções rápidas para editar e publicar a landing page no GitHub Pages.

## 📁 Estrutura de Arquivos

Todos os arquivos da landing page estão na pasta `docs/` (junto com a documentação técnica):

- `docs/index.html` - Página inicial (home)
- `docs/privacy.html` - Política de privacidade
- `docs/styles.css` - Estilos da página
- `docs/README_SITE.md` - Este arquivo com instruções

## ✏️ Como Editar os Conteúdos

### 1. E-mail de Contato

Edite o arquivo `docs/index.html` na seção "Contato" se precisar alterar o e-mail.

### 2. Números do WhatsApp

Os números já estão configurados, mas você pode editar em `docs/index.html` na seção "Contato" se necessário.

### 3. E-mail de Privacidade

Edite o arquivo `docs/privacy.html` nas seções relevantes se precisar alterar o e-mail de privacidade.

**Nota:** As informações de contato já foram preenchidas com os dados fornecidos.

## 🚀 Como Publicar no GitHub Pages

### Passo 1: Fazer Commit dos Arquivos

```bash
git add docs/index.html docs/privacy.html docs/styles.css
git commit -m "feat: move landing page para pasta docs/"
git push origin main
```

### Passo 2: Habilitar GitHub Pages

1. Acesse o repositório no GitHub
2. Vá em **Settings** (Configurações)
3. No menu lateral, clique em **Pages**
4. Em **Source** (Fonte):
   - Selecione **Deploy from a branch**
   - Escolha **Branch: main**
   - **Importante:** Escolha **Folder: /docs** (não / (root))
5. Clique em **Save** (Salvar)

**Nota:** O GitHub Pages só permite `/ (root)` ou `/docs` como pastas fonte. Por isso, os arquivos HTML foram movidos para `docs/` junto com a documentação técnica.

### Passo 3: Aguardar Publicação

Após salvar, o GitHub levará alguns minutos para publicar o site. Você verá uma mensagem como:

> "Your site is live at https://SEU_USUARIO.github.io/SEU_REPOSITORIO/"

### Passo 4: Verificar o Site

1. Acesse a URL fornecida pelo GitHub
2. Verifique se todas as páginas estão funcionando
3. Teste os links entre as páginas
4. Verifique se os dados da empresa foram atualizados

## 📋 Checklist de Publicação

- [ ] Editei todos os placeholders (empresa, e-mail, cidade, etc.)
- [ ] Revisei o conteúdo da política de privacidade
- [ ] Fiz commit dos arquivos
- [ ] Habilitei GitHub Pages nas configurações
- [ ] Verifiquei que o site está acessível na URL fornecida
- [ ] Testei todos os links (home → privacidade → home)
- [ ] Copiei o link final para usar em formulários

## 🔗 Link Final

Após a publicação, seu site estará disponível em:

```
https://SEU_USUARIO.github.io/SEU_REPOSITORIO/
```

Substitua:
- `SEU_USUARIO` pelo seu usuário do GitHub
- `SEU_REPOSITORIO` pelo nome do repositório

**Exemplo:** Se seu usuário é `joaosilva` e o repositório é `assusa`, o link será:
```
https://joaosilva.github.io/assusa/
```

## 📝 Notas Importantes

- **Estrutura:** Os arquivos da landing page estão na pasta `docs/` junto com a documentação técnica
- O site é totalmente estático (apenas HTML, CSS e JavaScript básico)
- Não há dependências externas ou frameworks
- Os estilos são responsivos e funcionam bem em dispositivos móveis
- A data de "Última atualização" na política de privacidade é preenchida automaticamente, mas você pode editá-la manualmente no HTML se necessário
- O ano no rodapé é atualizado automaticamente via JavaScript
- **GitHub Pages:** Configure para usar a pasta `/docs` como raiz (não a raiz do repositório)
- **Limitação do GitHub Pages:** O GitHub Pages só permite `/ (root)` ou `/docs` como pastas fonte. Por isso usamos `docs/` ao invés de `site/`

## 🆘 Solução de Problemas

### Site não aparece após habilitar Pages

- Aguarde alguns minutos (pode levar até 10 minutos)
- Verifique se os arquivos estão na branch `main` e na pasta `docs/`
- **Importante:** Confirme que selecionou `/docs` como pasta raiz nas configurações do GitHub Pages (não `/ (root)`)
- Verifique se o nome do repositório está correto na URL

### Erro 404 ao acessar o site

- Verifique se os arquivos estão na pasta `docs/` (não na raiz)
- Confirme que selecionou `/docs` nas configurações do GitHub Pages
- Confirme que os nomes dos arquivos estão corretos: `index.html` (minúsculo)
- Verifique se fez push para a branch correta

### Links não funcionam

- Verifique se os caminhos dos links estão corretos (`privacy.html`, `index.html`) - devem ser relativos, sem o prefixo `docs/`
- Teste abrindo os arquivos localmente no navegador antes de publicar (abra `docs/index.html` diretamente)
