# Landing Page - Instruções de Publicação

Este documento contém instruções rápidas para editar e publicar a landing page no GitHub Pages.

## 📁 Arquivos Criados

- `index.html` - Página inicial (home)
- `privacy.html` - Política de privacidade
- `styles.css` - Estilos da página

## ✏️ Como Editar os Conteúdos

### 1. Dados da Empresa

Edite o arquivo `index.html` na seção "Quem fornece este serviço" (por volta da linha 97):

```html
<p><strong>Empresa:</strong> <!-- ALTERE: Nome da empresa --></p>
<p><strong>Responsável:</strong> <!-- ALTERE: Nome do responsável --></p>
<p><strong>Localização:</strong> <!-- ALTERE: Cidade/Estado --></p>
```

### 2. E-mail de Contato

Edite o arquivo `index.html` na seção "Contato" (por volta da linha 89):

```html
<p><strong>E-mail:</strong> <a href="mailto:contato@seudominio.com.br">contato@seudominio.com.br</a></p>
```

### 3. Link do WhatsApp (Opcional)

Para adicionar um botão "Falar no WhatsApp", descomente a linha no `index.html` (por volta da linha 90):

```html
<p><strong>WhatsApp:</strong> <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a></p>
```

Substitua `5500000000000` pelo número do WhatsApp no formato internacional (código do país + DDD + número, sem espaços ou caracteres especiais).

### 4. E-mail de Privacidade

Edite o arquivo `privacy.html` nas seções relevantes:

- Seção "Canal de privacidade" (por volta da linha 85)
- Seção "Responsável pelo tratamento" (por volta da linha 92)

Substitua `privacidade@seudominio.com.br` pelo e-mail correto.

### 5. Dados da Empresa na Política

Edite o arquivo `privacy.html` na seção "Responsável pelo tratamento" (por volta da linha 92):

```html
<p><strong>Empresa:</strong> <!-- ALTERE: Nome da empresa --></p>
<p><strong>Responsável:</strong> <!-- ALTERE: Nome do responsável --></p>
<p><strong>Localização:</strong> <!-- ALTERE: Cidade/Estado --></p>
```

## 🚀 Como Publicar no GitHub Pages

### Passo 1: Fazer Commit dos Arquivos

```bash
git add index.html privacy.html styles.css README_SITE.md
git commit -m "feat: adiciona landing page e política de privacidade para GitHub Pages"
git push origin main
```

### Passo 2: Habilitar GitHub Pages

1. Acesse o repositório no GitHub
2. Vá em **Settings** (Configurações)
3. No menu lateral, clique em **Pages**
4. Em **Source** (Fonte):
   - Selecione **Deploy from a branch**
   - Escolha **Branch: main**
   - Escolha **Folder: / (root)**
5. Clique em **Save** (Salvar)

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

- O site é totalmente estático (apenas HTML, CSS e JavaScript básico)
- Não há dependências externas ou frameworks
- Os estilos são responsivos e funcionam bem em dispositivos móveis
- A data de "Última atualização" na política de privacidade é preenchida automaticamente, mas você pode editá-la manualmente no HTML se necessário
- O ano no rodapé é atualizado automaticamente via JavaScript

## 🆘 Solução de Problemas

### Site não aparece após habilitar Pages

- Aguarde alguns minutos (pode levar até 10 minutos)
- Verifique se os arquivos estão na branch `main` e na raiz do repositório
- Verifique se o nome do repositório está correto na URL

### Erro 404 ao acessar o site

- Verifique se os arquivos estão na raiz do repositório
- Confirme que os nomes dos arquivos estão corretos: `index.html` (minúsculo)
- Verifique se fez push para a branch correta

### Links não funcionam

- Verifique se os caminhos dos links estão corretos (`privacy.html`, `index.html`)
- Teste abrindo os arquivos localmente no navegador antes de publicar
