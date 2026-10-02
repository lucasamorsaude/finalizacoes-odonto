---
description: "Task list — Reformulação completa do Finaliza Odonto"
---

# Tasks: Reformulação completa do Finaliza Odonto

**Input**: Design documents from `/specs/001-reformulacao-completa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: e2e de fumaça exigidos pela constituição (gate antes do merge), na fase final.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Mover `supabase/schema.sql` para `supabase/migrations/001_inicial.sql` e atualizar referências em `supabase/README.md`
- [X] T002 [P] Criar `scripts/aplicar-migracao.mjs` (conexão direta do `.env`, transação, rollback) e adicionar `pg` em `scripts/package.json`
- [X] T003 [P] Criar `scripts/servidor-local.mjs` (servidor estático na porta 8765)
- [X] T004 [P] Adicionar `.claude/settings.local.json`, `tests/node_modules/` e artefatos de teste ao `.gitignore`

## Phase 2: Foundational (bloqueia todas as histórias)

- [X] T005 Escrever `supabase/migrations/002_reformulacao.sql`: status Recusado + check de motivo, `finalizado_em/por`, trigger de finalização, tabela `finalizacao_eventos` + trigger + RLS, índices, `resumo_fila`, `painel_indicadores`, `painel_serie`, `desempenho_profissionais`, `desempenho_semanal`, grants
- [X] T006 Aplicar a migração 002 e verificar como anônimo, profissional e admin (RLS, check, triggers, RPCs)
- [X] T007 [P] Design system em `assets/css/estilo.css`: tokens claro/escuro, tipografia, base, layout (sidebar/bottom bar), botões, campos, tabela, chips de status, cartões, toast, modal, esqueleto, utilitários
- [X] T008 [P] Identidade: `assets/img/logo.svg` e `assets/img/favicon.svg`
- [X] T009 [P] `assets/js/icones.js` com sprite Lucide e helper `icone(nome)`
- [X] T010 [P] `assets/js/supabase.js`: cliente ESM fixado, constantes (status, abertos, unidades, domínio, prefixo), `emailDoUsuario`, `carregarPerfil`, `sair`
- [X] T011 `assets/js/ui.js`: `esc`, formatação (data, idade relativa, números, horas), toast (com ação), modal acessível, `nomeCopiavel`, chip de status, estados (esqueleto/vazio/erro), debounce, parâmetros de URL
- [X] T012 `assets/js/app.js`: `iniciarApp({ tela, somenteAdmin })` → guarda de sessão/papel com `volta`, renderiza layout por papel, contador da fila, modal "Nova finalização" (dentista com nome fixo; admin escolhe)

**Checkpoint**: base pronta — histórias podem começar.

## Phase 3: User Story 1 — Fila do administrador (P1) 🎯 MVP

**Goal**: admin opera a fila: copiar nome, finalizar com desfazer, lote, aguardando, recusar com motivo, filtros, auto-atualização.

**Independent Test**: quickstart cenários 2–6.

- [X] T013 [US1] Criar `fila.html` (estrutura, filtros, resumo, lista, barra de lote)
- [X] T014 [US1] `assets/js/paginas/fila.js`: carga paginada + `resumo_fila`, filtros com URL, idade, seleção, finalizar otimista + desfazer, lote, modal de status/observação (motivo obrigatório para Recusado), atalhos de teclado, atualização a cada 60 s e ao voltar à aba
- [X] T015 [US1] Login novo em `login.html` + `assets/js/paginas/login.js` com redirecionamento para `volta`/`fila.html`

## Phase 4: User Story 2 — Pendências do dentista (P1)

**Goal**: dentista vê só os próprios abertos + recusados (30 dias), sem controles.

**Independent Test**: quickstart cenários 7–8.

- [X] T016 [US2] Modo profissional em `assets/js/paginas/fila.js`: sem seleção/ações, seção "Recusados recentemente" com motivo, texto de ajuda

## Phase 5: User Story 3 — Identidade e telas profissionais (P2)

**Goal**: formulário público e redirecionamentos na nova identidade.

**Independent Test**: quickstart cenários 1 e 11.

- [X] T017 [P] [US3] Novo `index.html` + `assets/js/paginas/formulario.js` (lembra unidade/profissional, foco em sequência, contador de registros na sessão, link de acesso)
- [X] T018 [P] [US3] `dashboard.html` → `fila.html` e `admin.html` → `usuarios.html` (redirecionamento)

## Phase 6: User Story 4 — Painel (P2)

**Goal**: indicadores e gráficos por período/unidade; dentista restrito.

**Independent Test**: quickstart cenário 10.

- [X] T019 [P] [US4] `assets/js/graficos.js`: colunas empilhadas (série), barra empilhada horizontal (faixas/profissionais), legenda, tooltip por marca (mouse e foco), alternância tabela, paleta validada por tema
- [X] T020 [US4] `painel.html` + `assets/js/paginas/painel.js`: filtros (período 7/30/90/365, unidade, profissional admin), KPIs, "em aberto agora" com faixas de idade, série, por unidade, link para a fila

## Phase 7: User Story 5 — Desempenho por profissional (P2)

**Independent Test**: abrir como admin, ordenar, abrir detalhe; como dentista → bloqueado.

- [X] T021 [US5] `desempenho.html` + `assets/js/paginas/desempenho.js`: tabela ordenável, gráfico comparativo empilhado, detalhe semanal em modal com atalhos para fila/registros

## Phase 8: User Story 6 — Registros e histórico (P3)

- [X] T022 [US6] `registros.html` + `assets/js/paginas/registros.js`: filtros, paginação, CSV (admin), detalhe com linha do tempo (`finalizacao_eventos`), edição de status/observação pelo admin no detalhe, nome copiável

## Phase 9: User Story 7 — Registro interno e usuários (P3)

- [X] T023 [US7] `usuarios.html` + `assets/js/paginas/usuarios.js` no novo padrão (lista com busca, criar/editar/senha via Edge Function, ativar/inativar, admin)
- [X] T024 [US7] Validar "Nova finalização" do `app.js` para dentista (nome fixo) e admin (escolhe profissional)

## Phase 10: Polish & gate

- [X] T025 Remover arquivos antigos (`admin.css/js`, `dashboard.css/js`, `index.css`, `login.css`, `script.js`, `supabase-client.js`, `PLANO_MELHORIAS.md`)
- [X] T026 [P] Testes e2e em `tests/e2e/rodar.mjs` cobrindo os 12 cenários do quickstart, com limpeza
- [X] T027 Rodar e2e, revisar capturas (desktop, 360 px, escuro), corrigir problemas
- [X] T028 [P] Atualizar `supabase/README.md` (migrações, testes, papéis, status Recusado)
- [X] T029 Merge na `main`, verificar site publicado (cenários somente leitura)

## Dependencies & Execution Order

- Setup (T001–T004) → Foundational (T005–T012) → histórias.
- US1 (T013–T015) é o MVP; US2 (T016) depende de T014 (mesmo arquivo).
- US3, US4, US5, US6, US7 dependem só da fase 2; T020 depende de T019; T021 depende de T019.
- Polish depois de todas as histórias.

## Parallel Opportunities

- T002, T003, T004 juntos; T007–T010 juntos (arquivos diferentes).
- Após a fase 2: T017, T018, T019 em paralelo com US1.

## Implementation Strategy

MVP = fases 1–4 (fila para admin e dentista). Em seguida painel e desempenho (gestão), depois registros
e usuários. Gate e2e antes do merge; publicação única ao final para a equipe receber tudo junto.
