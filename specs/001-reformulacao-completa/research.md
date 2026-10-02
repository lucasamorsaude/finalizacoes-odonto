# Research: Reformulação completa do Finaliza Odonto

Cada decisão segue o formato Decisão / Razão / Alternativas consideradas.

## R1. Arquitetura do front-end

- **Decisão**: site multi-página estático (um HTML por tela) com ES modules nativos; camada compartilhada
  em `assets/js/` (cliente do banco, guarda de sessão + layout, componentes de UI, ícones, gráficos) e um
  módulo por tela em `assets/js/paginas/`.
- **Razão**: Princípio I (sem build, GitHub Pages direto da `main`) e VI (simplicidade). Cada tela carrega
  só o que usa; URLs simples e compartilháveis; o mantenedor já trabalha com JS puro.
- **Alternativas**: SPA com Vite/React (exige build + Actions, viola I); Preact+htm via CDN (mais uma
  abstração sem ganho real para 7 telas); Alpine.js (estado espalhado em atributos, pior para tabelas
  com edição otimista).

## R2. Cliente do Supabase

- **Decisão**: `@supabase/supabase-js@2.117.2` importado como ESM do jsDelivr (`/+esm`), versão fixada.
- **Razão**: Princípio I (CDN com versão fixa); ESM permite `import` nos módulos sem variável global.
- **Alternativas**: UMD global (atual) — funciona, mas mistura scripts clássicos e módulos.

## R3. Gráficos

- **Decisão**: SVG desenhado à mão num módulo `graficos.js` (colunas empilhadas por período e barras
  horizontais empilhadas), seguindo a skill de dataviz: marcas finas (≤ 24 px), cantos de 4 px na ponta,
  2 px de respiro entre segmentos, grade em hairline sólida, tooltip por marca, legenda sempre presente e
  alternância "ver como tabela".
- **Paleta validada** (script `validate_palette.js`, todas as checagens PASS):
  - Categórica (3 séries, all-pairs) — claro `#2a78d6, #eb6834, #1baf7a`; escuro `#3987e5, #d95926, #199e70`.
    Aviso de contraste do aqua no claro (2,74:1) → alívio obrigatório: rótulos visíveis + visão em tabela.
  - Ordinal (faixas de idade) — claro `#86b6ef → #104281`; escuro invertido `#1c5cab → #86b6ef`.
- **Razão**: só 2 tipos de gráfico; biblioteca externa (Chart.js ~200 KB) traria estilo a ser
  desfeito para cumprir as regras de marca/espaçamento.
- **Alternativas**: Chart.js, ECharts, uPlot.

## R4. Ícones e identidade

- **Decisão**: sprite SVG inline em `icones.js` com caminhos do Lucide (licença ISC); logotipo SVG
  próprio (dente estilizado + check). Fonte Inter (Google Fonts). Cor de marca: teal clínico
  (`#0f766e` claro / `#2dd4bf` escuro para destaques), neutros quentes da paleta de dataviz.
  Modo escuro via `prefers-color-scheme` com tokens CSS.
- **Razão**: remove a dependência do Font Awesome beta; ícones nítidos e coloríveis por `currentColor`.
- **Alternativas**: Font Awesome 6 estável (CSS de 100 KB para ~20 ícones); Lucide via CDN (mais um script).

## R5. Fila: atualização, desfazer e lote

- **Decisão**: consulta periódica a cada 60 s e no evento `visibilitychange`; finalização otimista
  (remove da lista na hora) com toast "Desfazer" por 6 s que reverte para o status anterior; seleção
  múltipla com barra de ações em lote (`update ... in (ids)`).
- **Razão**: FR-003/004/008 sem infraestrutura de tempo real; o volume (~30/dia) não justifica Realtime.
- **Alternativas**: Supabase Realtime (mais conexões, mais casos de erro, ganho marginal).

## R6. Histórico e data de finalização

- **Decisão**: tabela `finalizacao_eventos` preenchida por trigger `AFTER UPDATE` quando status ou
  observação mudam; colunas `finalizado_em`/`finalizado_por` mantidas por trigger `BEFORE UPDATE`.
- **Razão**: auditoria não pode depender do front (Princípio II); triggers cobrem ações em lote e
  qualquer cliente.
- **Alternativas**: gravar eventos pelo front (burlável, esquecível).

## R7. Métricas de painel e desempenho

- **Decisão**: funções SQL que agregam no banco (Princípio IV):
  - Coorte do período = registros recebidos no período; para eles: finalizados, em aberto, recusados,
    taxa = finalizados ÷ recebidos (recusados contam no denominador).
  - Tempo médio até finalizar = média de `finalizado_em − created_at` dos itens com `finalizado_em` no
    período (itens migrados não têm essa data → aviso "dados a partir de dd/mm").
  - "Em aberto agora" (independe do período) com faixas de idade < 7, 7–30, 30–90, > 90 dias.
  - Série: por dia se o período ≤ 45 dias, senão por semana; cada barra empilha a situação atual dos
    recebidos naquele intervalo (finalizados / em aberto / recusados).
- **Razão**: funciona para o histórico migrado (que não tem data de finalização) e para os dados novos.
- **Alternativas**: série "finalizações por dia" — vazia para todo o histórico migrado, enganosa.

## R8. Status "Recusado"

- **Decisão**: novo status encerrado; restrição no banco exige observação não vazia quando
  `status = 'Recusado'`.
- **Razão**: 245 itens com > 30 dias abertos, muitos com motivos de não-finalização ("fora do período
  de 6 meses"); o dentista precisa ver o motivo.

## R9. Testes

- **Decisão**: testes e2e em `tests/e2e/` com `playwright-core` usando o Edge instalado, contra um
  servidor estático local; credenciais de admin lidas do `.env`. Testes que escrevem criam um usuário e
  registros temporários e apagam tudo ao final.
- **Razão**: gate da constituição; sem banco de testes separado, a limpeza garante zero resíduo.

## R10. Migrações

- **Decisão**: `supabase/migrations/NNN_nome.sql` + `scripts/aplicar-migracao.mjs` (conexão direta do
  `.env`, transação única, rollback em erro). `schema.sql` atual vira `001_inicial.sql`.
