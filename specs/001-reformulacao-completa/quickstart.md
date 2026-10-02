# Quickstart: validar a reformulação

## Pré-requisitos

- `.env` na raiz com `DATABASE_URL`, `DATABASE_PUBLISH_KEY`, `DATABASE_DIRECT_CONNECTION_STRING`,
  `SUPABASE_SECRET_KEY`, `E2E_ADMIN_USUARIO`, `E2E_ADMIN_SENHA`.
- Node 20+, Microsoft Edge instalado.

## 1. Aplicar migração

```bash
cd scripts && npm install
node aplicar-migracao.mjs ../supabase/migrations/002_reformulacao.sql
```
Esperado: "Migração aplicada." — em erro, nada muda (transação).

## 2. Rodar o site localmente

```bash
node scripts/servidor-local.mjs      # http://localhost:8765
```

## 3. Testes e2e

```bash
cd tests && npm install && node e2e/rodar.mjs
```
Cenários (todos devem passar e não deixar resíduo):

| # | Cenário | Esperado |
|---|---|---|
| 1 | Anônimo abre `index.html`, registra para profissional temporário | sucesso; unidade/profissional continuam preenchidos |
| 2 | Admin faz login | cai em `fila.html` em < 2 s, item do cenário 1 visível |
| 3 | Admin clica no nome | área de transferência contém o nome exato |
| 4 | Admin finaliza, depois "Desfazer" | item some e volta; histórico tem 2 eventos |
| 5 | Admin recusa sem motivo / com motivo | bloqueado / sai da fila |
| 6 | Admin finaliza 2 itens em lote | ambos finalizados, `finalizado_em` preenchido |
| 7 | Profissional temporário faz login | vê só os seus abertos + recusados; sem controles de status |
| 8 | Profissional tenta `PATCH` via API | 0 linhas alteradas |
| 9 | Profissional abre `desempenho.html` | redirecionado; RPC de desempenho retorna erro |
| 10 | Painel e desempenho como admin | números coerentes com contagens diretas |
| 11 | Todas as telas em 360 px | `scrollWidth ≤ 360`, sem erros de console |
| 12 | Limpeza | usuário e registros temporários removidos |

## 4. Publicação

Merge do branch na `main` → GitHub Pages publica em ~1 min. Rodar os cenários 2, 3, 10, 11 contra a URL
publicada (somente leitura).
