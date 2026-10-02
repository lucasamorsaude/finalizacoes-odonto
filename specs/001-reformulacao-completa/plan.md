# Implementation Plan: Reformulação completa do Finaliza Odonto

**Branch**: `redesign` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-reformulacao-completa/spec.md`

## Summary

Reconstruir todas as telas sobre uma camada compartilhada (design system com nova identidade
"Finaliza Odonto", layout por papel, componentes), adicionando: fila de finalização (admin opera,
dentista acompanha), status "Recusado", histórico auditado, painel com indicadores e desempenho por
profissional. Backend continua Supabase; novas regras e agregações vivem no banco (migração 002).

## Technical Context

**Language/Version**: HTML5, CSS3 (custom properties, container-free), JavaScript ES2022 com ES modules
nativos; SQL (PostgreSQL 17); TypeScript/Deno só na Edge Function existente.

**Primary Dependencies**: `@supabase/supabase-js@2.117.2` (ESM via jsDelivr); fonte Inter (Google
Fonts); ícones Lucide embutidos (ISC). Nenhuma outra.

**Storage**: Supabase Postgres — tabelas `finalizacoes`, `usuarios`, nova `finalizacao_eventos`.

**Testing**: e2e com `playwright-core` + Microsoft Edge local (`tests/e2e`), dados temporários com
limpeza; verificação de RLS por papel via supabase-js.

**Target Platform**: navegadores modernos (Chrome/Edge/Safari/Firefox últimas 2 versões), desktop e
celular; hospedagem GitHub Pages.

**Project Type**: aplicação web estática + BaaS.

**Performance Goals**: telas interativas ≤ 2 s; feedback de ação < 300 ms; filtros ≤ 1 s.

**Constraints**: sem build; 360 px sem rolagem horizontal; contraste AA; pt-BR; fuso America/Sao_Paulo.

**Scale/Scope**: ~5,2 mil registros (+30/dia), 26 usuários, 7 telas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | OK |
|---|---|---|
| I. Estático e sem build | ES modules nativos, CDN com versão fixa, Pages direto da `main` | ✅ |
| II. Segurança no banco | RLS para eventos; check de motivo em Recusado; desempenho bloqueado a não-admin dentro da função; registro por profissional força o próprio nome | ✅ |
| III. Papéis claros | menu e ações por papel; banco impõe | ✅ |
| IV. Velocidade | paginação 100/50; agregações por RPC; atualização otimista | ✅ |
| V. Usabilidade | fila com cópia em 1 clique, finalizar em 1 clique, lote, desfazer, atalhos; 360 px; AA; teclado | ✅ |
| VI. Simplicidade | 1 módulo por tela + camada comum; gráficos SVG próprios (2 tipos) em vez de biblioteca | ✅ |

Re-check pós-design: sem violações; nada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-reformulacao-completa/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── banco.md
│   └── telas.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
index.html  login.html  fila.html  painel.html  desempenho.html  registros.html  usuarios.html
dashboard.html  admin.html                      # redirecionamentos
assets/
├── css/estilo.css                              # tokens, base, layout, componentes, gráficos
├── img/logo.svg  img/favicon.svg
└── js/
    ├── supabase.js                             # cliente, constantes, helpers de sessão
    ├── app.js                                  # guarda de papel + layout (menu, nova finalização)
    ├── ui.js                                   # toast, modal, nome copiável, formatação, estados
    ├── icones.js                               # sprite SVG
    ├── graficos.js                             # colunas/barras empilhadas, legenda, tooltip, tabela
    └── paginas/
        ├── formulario.js  login.js  fila.js  painel.js
        ├── desempenho.js  registros.js  usuarios.js
supabase/
├── migrations/001_inicial.sql  002_reformulacao.sql
├── functions/admin-usuarios/index.ts
└── README.md
scripts/  (migrar.mjs, aplicar-migracao.mjs, servidor-local.mjs)
tests/e2e/ (rodar.mjs + cenários)
```

**Structure Decision**: aplicação estática única na raiz (Pages serve a raiz da `main`), com assets
agrupados; arquivos antigos (`*.css`, `*.js` soltos, `supabase-client.js`) removidos.

## Complexity Tracking

Sem violações.
