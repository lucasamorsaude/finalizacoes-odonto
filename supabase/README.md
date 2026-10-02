# Migração para o Supabase

O site continua estático no GitHub Pages; os dados saem da planilha/Apps Script e vão para o Supabase (Postgres + login + API).

## 1. Criar o projeto

1. Crie uma conta em https://supabase.com e um projeto novo (região **South America (São Paulo)**).
2. **Authentication → Sign In / Providers**:
   - Deixe o provedor **Email** habilitado.
   - **Desligue "Allow new users to sign up"** — usuários só são criados pelo painel admin.
3. **SQL Editor**: cole e rode o conteúdo de [`schema.sql`](schema.sql). *(Já aplicado no projeto atual.)*

## 2. Edge Function (criação de usuários e troca de senha)

**Edge Functions → Deploy a new function → Via Editor**, nome `admin-usuarios`, cole o conteúdo de
[`functions/admin-usuarios/index.ts`](functions/admin-usuarios/index.ts) e publique.

(Alternativa via terminal: `npx supabase login` e depois
`npx supabase functions deploy admin-usuarios --project-ref <ref-do-projeto>`.)

## 3. Configurar o site

A URL do projeto e a chave **publishable** já estão no topo de [`../supabase-client.js`](../supabase-client.js).

Essa chave é pública por design. A chave **secret / service_role** nunca vai para o site nem para o Git.

## 4. Migrar os dados

1. No Google Sheets: **Arquivo → Fazer download → Microsoft Excel (.xlsx)** e salve na raiz do projeto
   como `Finalizações Odonto.xlsx` (o `.gitignore` impede que vá para o Git — contém dados de pacientes e senhas).
2. No `.env` da raiz, além do que já existe, adicione `SUPABASE_SECRET_KEY=<secret key>`
   (Project Settings → API Keys → Secret keys).
3. Rode:

```powershell
cd scripts
npm install
node migrar.mjs --dry-run      # confere usuários, status e avisos sem gravar nada
node migrar.mjs
```

- Lê as abas **Dezembro**, **JANFEVMAR** e **Finalizações** (histórico completo) e a aba **Usuarios**.
  Registros repetidos entre abas são descartados.
- **Pode rodar de novo** com uma cópia mais nova da planilha: só entram finalizações e usuários que ainda
  não estão no banco; nada editado no sistema é sobrescrito.
- Usuários mantêm as senhas atuais. Logins com espaço/acento são normalizados (ex.: `Dra Ana` → `dra.ana`);
  o login aceita a forma antiga também, porque a normalização é aplicada ao digitar.
- O status (texto livre na planilha) vira um de: Pendente, Aguardando liberação, Aguardando pagamento, Finalizado.
  Quando o texto tinha mais informação, ele é preservado no campo **Observação**.
  Casos ambíguos (ex.: "finalizado, mas teve erro") vão para **Pendente** para revisão.

## 5. Virada

1. Teste o site localmente ou num fork/branch (formulário, login de profissional, login admin, edição de status).
2. Faça merge na `main` → GitHub Pages publica.
3. **Arquive a implantação do Apps Script** (Implantar → Gerenciar implantações → Arquivar).
   Hoje ela devolve todos os dados de pacientes e as senhas sem autenticação.
4. Apague `codigo.gs` do repositório.

## Detalhes técnicos

- Login: o Supabase Auth usa e-mail, então `usuario` vira `usuario@finalizacoes.local` e a senha recebe o prefixo
  `odonto:` (o Supabase exige 6+ caracteres). Os mesmos valores estão em `supabase-client.js`,
  na Edge Function e no script de migração — se mudar um, mude os três.
- Permissões (tudo em `schema.sql`, via RLS):
  - anônimo: só lista profissionais ativos e registra finalização (funções `listar_profissionais` / `registrar_finalizacao`);
  - profissional: vê apenas os próprios registros;
  - admin: vê tudo, altera status/observação, gerencia usuários.
- Renomear o profissional de um usuário **não** renomeia os registros antigos (o vínculo é pelo nome, como na planilha).
