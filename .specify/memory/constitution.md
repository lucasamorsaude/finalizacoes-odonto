<!--
Sync Impact Report
- Versão: (template) → 1.0.0
- Princípios definidos: I. Estático e sem build; II. Segurança no banco; III. Papéis claros;
  IV. Velocidade percebida; V. Usabilidade operacional; VI. Simplicidade
- Seções adicionadas: Restrições técnicas e de dados; Fluxo de desenvolvimento e qualidade
- Templates: plan-template.md ✅ (Constitution Check genérico, sem ajuste necessário);
  spec-template.md ✅; tasks-template.md ✅ (testes e2e tratados como gate, não TDD)
- TODOs pendentes: nenhum
-->

# Finaliza Odonto — Constituição

## Core Principles

### I. Estático e sem etapa de build

O site MUST ser servido pelo GitHub Pages direto da branch `main`, sem compilação, bundler ou
GitHub Actions. O código do navegador MUST usar HTML, CSS e JavaScript com ES modules nativos.
Bibliotecas externas MUST vir de CDN permitido (jsDelivr/cdnjs/unpkg) com versão fixada.

*Razão*: qualquer pessoa da equipe consegue editar um arquivo e publicar; não há pipeline para quebrar.

### II. Segurança mora no banco

Toda regra de acesso MUST ser imposta no Postgres (RLS, privilégios por coluna e funções
`security definer` com validação). A interface NUNCA é fronteira de segurança: esconder um
botão não substitui uma política. Chaves secretas MUST ficar fora do repositório e do site.
Dados de pacientes (dados de saúde — LGPD) MUST trafegar apenas entre o banco e usuários
autorizados; exportações são restritas a administradores.

*Razão*: o repositório e o JavaScript são públicos; só o banco pode garantir quem vê o quê.

### III. Papéis claros

- **Administrador** finaliza, altera status, gerencia usuários e vê todos os registros.
- **Profissional (dentista)** registra e acompanha apenas os próprios registros; não altera status.
- **Público (sem login)** apenas registra uma finalização para um profissional ativo.

Cada tela MUST deixar evidente o que o papel atual pode fazer e MUST omitir ações que ele não pode.

### IV. Velocidade percebida

Telas MUST ficar interativas em até 2 s em conexão comum. Listas MUST ser paginadas e
agregações (contagens, desempenho, séries) MUST ser calculadas no banco — o navegador nunca
baixa a base inteira. Ações de rotina (finalizar, filtrar, copiar) MUST responder em < 300 ms
de feedback visual, com atualização otimista quando segura.

### V. Usabilidade operacional

O fluxo diário do administrador (abrir fila → copiar nome → finalizar) MUST exigir o mínimo de
cliques, com atalhos e ações em lote. Toda tela MUST funcionar em celular (sem rolagem
horizontal), ter contraste AA, foco visível e operação por teclado. Textos MUST estar em pt-BR,
diretos e consistentes; datas no fuso de Brasília.

### VI. Simplicidade

Sem frameworks de UI: módulos JS pequenos, um por tela, sobre uma camada compartilhada
(cliente do banco, layout, componentes). Mudanças de banco MUST ser migrações SQL numeradas,
aplicadas em transação. Toda complexidade adicional MUST ser justificada no plano.

## Restrições técnicas e de dados

- Backend: Supabase (Postgres + Auth + Edge Functions). Sem servidor próprio.
- Status de finalização são um conjunto fechado definido no banco; texto livre vai em Observação.
- Registros não são apagados no fluxo normal; mudanças de status MUST ficar auditadas
  (quem, quando, de/para).
- Credenciais e a planilha de origem MUST constar no `.gitignore`.

## Fluxo de desenvolvimento e qualidade

- Trabalho em branch; merge na `main` publica em produção.
- Antes do merge: testes e2e de fumaça no navegador (Playwright + Edge) cobrindo login por
  papel, fila, finalização e permissões. Testes que alteram dados MUST desfazer as alterações.
- Migrações de banco MUST ser testadas em transação e verificadas com consultas como o papel
  real (anônimo, profissional, admin) antes de declarar pronto.

## Governance

Esta constituição prevalece sobre preferências pontuais. Alterações exigem atualização deste
arquivo com nova versão semântica (MAJOR: remove/redefine princípio; MINOR: adiciona princípio
ou seção; PATCH: redação) e revisão dos templates em `.specify/templates/`. Todo plano MUST
passar pelo "Constitution Check" e justificar violações em "Complexity Tracking".

**Version**: 1.0.0 | **Ratified**: 2026-10-02 | **Last Amended**: 2026-10-02
