# Finaliza Odonto — operação e manutenção

Site estático (GitHub Pages, branch `main`) + Supabase (Postgres, Auth, Edge Function).
Especificação e decisões: [`specs/001-reformulacao-completa/`](../specs/001-reformulacao-completa/).

## Papéis

| Papel | Pode |
|---|---|
| Público (sem login) | Registrar procedimento pelo formulário (`index.html`) |
| Profissional | Ver os próprios itens (fila, painel, registros) e registrar pelo sistema |
| Administrador | Finalizar, alterar status, recusar com motivo, ver tudo, desempenho, usuários |

Status: **Pendente**, **Aguardando liberação**, **Aguardando pagamento** (abertos, na fila),
**Finalizado** e **Recusado** (encerrados; recusa exige motivo, visível ao profissional).
Toda alteração de status/observação fica no histórico (`finalizacao_eventos`).

## Configuração (já feita no projeto atual)

1. Projeto Supabase; **Authentication → Sign In / Providers**: provedor Email ligado e
   "Allow new users to sign up" **desligado**.
2. Migrações em ordem: `supabase/migrations/001_inicial.sql`, `002_reformulacao.sql`.
3. Edge Function `admin-usuarios` (`supabase/functions/admin-usuarios/index.ts`).
4. URL e chave publishable em `assets/js/supabase.js` (chave pública por design).

## `.env` (raiz, fora do Git)

```
DATABASE_URL=...                      # URL do projeto
DATABASE_PUBLISH_KEY=...              # chave publishable
DATABASE_DIRECT_CONNECTION_STRING=... # para aplicar migrações
SUPABASE_SECRET_KEY=...               # service_role — migração e limpeza de testes
SUPABASE_ACCESS_TOKEN=...             # opcional — publicar Edge Function pela CLI
E2E_ADMIN_USUARIO=... / E2E_ADMIN_SENHA=...
```

## Tarefas comuns

```bash
# Nova migração de banco (transação única; em erro nada muda)
cd scripts && npm install
node aplicar-migracao.mjs ../supabase/migrations/003_algo.sql

# Rodar o site localmente
node scripts/servidor-local.mjs          # http://localhost:8765

# Testes e2e (gate antes de publicar) — cria e apaga dados temporários
cd tests && npm install && npm run e2e   # capturas em tests/capturas/

# Publicar a Edge Function
npx supabase functions deploy admin-usuarios --project-ref vxeuacxxzjmpqlqgnoqd

# Importar registros novos de uma cópia da planilha (.xlsx na raiz; só entra o que falta)
cd scripts && node migrar.mjs --dry-run && node migrar.mjs
```

## Detalhes

- Login por usuário: vira `usuario@finalizacoes.local` e a senha recebe o prefixo `odonto:`
  (o Supabase exige 6+ caracteres). Os valores estão em `assets/js/supabase.js`, na Edge Function e
  em `scripts/migrar.mjs` — se mudar um, mude os três.
- O vínculo registro ↔ profissional é pelo nome; renomear um usuário não altera registros antigos.
- O tempo até finalizar só existe para finalizações feitas no sistema (os dados da planilha não têm).
