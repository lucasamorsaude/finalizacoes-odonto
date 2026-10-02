# Feature Specification: Reformulação completa do Finaliza Odonto

**Feature Branch**: `redesign`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Ajustar o projeto por completo, reformular tudo: telas de dashboard, desempenho
por profissional, rebranding geral e profissionalizar todas as telas, melhorar usabilidade. Quem finaliza são
os usuários admin. Clicar no nome e copiar o nome do paciente. Criar uma fila de finalizações para admin e
para os dentistas visualizarem só o que está pendente."

## Contexto

Dentistas da AmorSaúde São João del-Rei (unidades SJDR e SJDR APOIO) registram procedimentos concluídos
que precisam ser "finalizados" (baixados) no sistema da clínica por um administrador. Hoje: ~30 registros
por dia (pico de 67), 16 profissionais ativos, 353 itens em aberto — 245 deles com mais de 30 dias,
sem forma de encerrar itens que nunca serão finalizados.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fila de finalização do administrador (Priority: P1) 🎯 MVP

O administrador abre o sistema e cai direto numa fila com tudo que está em aberto, do mais antigo
para o mais novo. Para cada item ele clica no nome do paciente (o nome vai para a área de
transferência), procura o paciente no sistema da clínica, dá a baixa lá e marca o item como
Finalizado com um clique. Itens que dependem de terceiros ficam em "Aguardando"; itens que nunca serão
finalizados são recusados com um motivo, saindo da fila.

**Why this priority**: é o trabalho diário de quem finaliza; hoje é o gargalo e a origem do acúmulo.

**Independent Test**: logar como admin, abrir a fila, copiar um nome, finalizar um item e ver a fila e os
contadores atualizarem.

**Acceptance Scenarios**:

1. **Given** um admin logado, **When** ele entra no sistema, **Then** vê a fila de itens em aberto
   (Pendente, Aguardando liberação, Aguardando pagamento), ordenada do mais antigo para o mais novo, com
   idade de cada item ("há 3 dias") e contadores por status.
2. **Given** a fila aberta, **When** o admin clica no nome de um paciente, **Then** o nome exato é copiado
   e uma confirmação visual aparece por ~2 s.
3. **Given** um item na fila, **When** o admin clica em "Finalizar", **Then** o item sai da fila
   imediatamente, os contadores atualizam e é possível desfazer por alguns segundos.
4. **Given** vários itens selecionados, **When** o admin escolhe "Finalizar selecionados", **Then** todos
   são finalizados de uma vez.
5. **Given** um item, **When** o admin escolhe "Recusar", **Then** o sistema exige um motivo; o item sai da
   fila e o motivo fica visível para o dentista.
6. **Given** um item, **When** o admin muda para "Aguardando liberação" ou "Aguardando pagamento" com uma
   observação, **Then** o item permanece na fila com o novo status e a observação.
7. **Given** a fila, **When** o admin filtra por unidade, profissional, status, idade ou busca por
   paciente, **Then** a lista e os contadores refletem o filtro.
8. **Given** um novo registro feito por um dentista, **When** o admin está com a fila aberta, **Then** ele
   aparece em até 1 minuto sem recarregar a página.

---

### User Story 2 - Pendências do dentista (Priority: P1)

O dentista entra e vê só o que é dele e ainda não foi finalizado: status, há quanto tempo está aberto e a
observação/motivo deixado pelo admin. Também vê os itens recusados recentemente, para corrigir ou
reenviar. Não consegue alterar status.

**Why this priority**: hoje o dentista não tem visibilidade do que está travado e por quê.

**Independent Test**: logar como um dentista e conferir que a fila mostra apenas itens abertos dele, sem
controles de alteração.

**Acceptance Scenarios**:

1. **Given** um dentista logado, **When** entra no sistema, **Then** vê apenas os próprios itens em aberto,
   com status, idade e observação.
2. **Given** a fila do dentista, **When** ele procura qualquer controle de alteração de status, **Then**
   nenhum existe (e o banco recusa a alteração mesmo que forçada).
3. **Given** um item recusado nos últimos 30 dias, **When** o dentista abre sua fila, **Then** o item aparece
   numa seção "Recusados recentemente" com o motivo.
4. **Given** o dentista, **When** clica no nome do paciente, **Then** o nome é copiado, igual ao admin.

---

### User Story 3 - Identidade visual e telas profissionais (Priority: P2)

Todo o sistema ganha identidade própria ("Finaliza Odonto"), navegação lateral consistente, componentes
padronizados, estados de carregamento/vazio/erro claros, modo escuro automático e funcionamento completo
no celular. O formulário público lembra a unidade e o profissional usados por último no aparelho e
permite registrar vários procedimentos seguidos sem redigitar.

**Why this priority**: a percepção de qualidade e a velocidade de uso dependem disso, mas a fila funciona
sem ela.

**Independent Test**: percorrer todas as telas em desktop e em celular (360 px) verificando layout,
navegação, estados e acessibilidade.

**Acceptance Scenarios**:

1. **Given** qualquer tela, **When** aberta em 360 px de largura, **Then** não há rolagem horizontal e
   todas as ações estão acessíveis.
2. **Given** o formulário público, **When** o dentista registra um procedimento, **Then** unidade e
   profissional continuam preenchidos para o próximo registro, e o foco volta ao nome do paciente.
3. **Given** um usuário logado, **When** navega, **Then** vê o menu com apenas as telas do seu papel, o
   nome do usuário e a opção de sair.
4. **Given** uma carga lenta ou falha, **When** a tela espera dados, **Then** mostra esqueleto de
   carregamento; em erro, mensagem clara com opção de tentar de novo.

---

### User Story 4 - Painel (dashboard) (Priority: P2)

O admin vê, para um período (padrão: últimos 30 dias), indicadores: registros recebidos, finalizados,
em aberto, recusados, taxa de finalização e tempo médio até finalizar; evolução diária de registros vs.
finalizações; distribuição por status e por unidade; e os itens abertos mais antigos. O dentista vê o
mesmo painel restrito aos próprios números.

**Why this priority**: dá visão de gestão; depende dos dados que a fila (US1) passa a produzir.

**Independent Test**: abrir o painel como admin, trocar período e unidade e conferir que os números batem
com a consulta de registros.

**Acceptance Scenarios**:

1. **Given** o admin no painel, **When** escolhe um período e unidade, **Then** todos os indicadores e
   gráficos recalculam para o filtro.
2. **Given** o dentista no painel, **When** abre a tela, **Then** vê apenas números dele.
3. **Given** finalizações feitas pelo sistema novo, **When** o painel calcula tempo médio, **Then** usa a
   data real de finalização (itens migrados sem essa data ficam fora da média, com aviso).

---

### User Story 5 - Desempenho por profissional (Priority: P2)

O admin compara profissionais no período: volume registrado, finalizados, em aberto, recusados, taxa de
finalização, tempo médio até finalizar e idade do item aberto mais antigo. Pode ordenar por qualquer
coluna e clicar num profissional para ver a evolução dele e abrir a fila/registros já filtrados.

**Why this priority**: pedido explícito de gestão; independe das demais telas além dos dados.

**Independent Test**: abrir a tela, ordenar por volume, clicar em um profissional e conferir o detalhe.

**Acceptance Scenarios**:

1. **Given** o admin na tela de desempenho, **When** escolhe período/unidade, **Then** vê uma linha por
   profissional com as métricas acima e um gráfico comparativo de volume.
2. **Given** a tabela, **When** clica no cabeçalho de uma métrica, **Then** ordena por ela.
3. **Given** um profissional, **When** clica nele, **Then** vê evolução semanal e atalhos para a fila e os
   registros filtrados por ele.

---

### User Story 6 - Consulta de registros e histórico (Priority: P3)

Busca completa em todos os registros (qualquer status) com filtros, paginação e exportação CSV (admin).
Ao abrir um registro, vê detalhes e a linha do tempo: registrado em, cada mudança de status (quem,
quando, de → para, observação).

**Why this priority**: consulta já existe; o ganho é o histórico e a padronização.

**Independent Test**: buscar um paciente, abrir o registro e ver a linha do tempo após uma mudança.

**Acceptance Scenarios**:

1. **Given** um registro alterado pela fila, **When** aberto, **Then** a linha do tempo mostra a mudança
   com autor e horário.
2. **Given** o admin, **When** exporta, **Then** o CSV contém exatamente os registros do filtro atual.

---

### User Story 7 - Registro dentro do sistema e gestão de usuários (Priority: P3)

O dentista logado registra uma finalização sem escolher o próprio nome. O admin gerencia usuários
(criar, editar, ativar/inativar, redefinir senha, marcar admin) numa tela no mesmo padrão visual.

**Independent Test**: dentista registra pelo sistema e o item aparece na fila do admin; admin cria e
inativa um usuário.

**Acceptance Scenarios**:

1. **Given** um dentista logado, **When** usa "Nova finalização", **Then** o profissional já vem definido
   como ele e não pode ser trocado.
2. **Given** o admin na gestão de usuários, **When** inativa um usuário, **Then** ele some do formulário
   público e perde o acesso.

### Edge Cases

- Dois admins finalizam o mesmo item ao mesmo tempo: a segunda ação não gera erro confuso; o item
  simplesmente já está finalizado.
- Admin desfaz uma finalização: o item volta ao status anterior e o histórico registra as duas mudanças.
- Navegador sem permissão de área de transferência: o nome fica selecionado para cópia manual e o
  sistema avisa.
- Sessão expirada no meio do uso: o usuário é levado ao login e volta para a mesma tela depois.
- Dentista renomeado ou inativado: registros antigos continuam vinculados ao nome registrado.
- Itens migrados sem data de finalização: não entram no cálculo de tempo médio.
- Fila vazia: mensagem positiva ("Nada pendente") em vez de tabela vazia.

## Requirements *(mandatory)*

### Functional Requirements

**Fila e finalização**

- **FR-001**: O sistema MUST oferecer uma fila com os itens em aberto (Pendente, Aguardando liberação,
  Aguardando pagamento), ordenada por data de registro crescente, com idade do item visível.
- **FR-002**: Apenas administradores MUST poder alterar status; a regra MUST valer no banco.
- **FR-003**: Admin MUST poder finalizar um item com uma única ação e desfazer por pelo menos 5 s.
- **FR-004**: Admin MUST poder selecionar vários itens e finalizá-los em lote.
- **FR-005**: O sistema MUST ter o status "Recusado", que exige motivo e retira o item da fila.
- **FR-006**: Clicar no nome do paciente MUST copiar o nome para a área de transferência com confirmação
  visual, em todas as listas.
- **FR-007**: A fila MUST permitir filtro por unidade, profissional, status, faixa de idade e busca por
  paciente, com contadores por status respeitando o filtro.
- **FR-008**: A fila do admin MUST se atualizar sozinha (no máximo a cada 60 s e ao voltar para a aba).
- **FR-009**: Dentistas MUST ver apenas os próprios itens em aberto e os recusados nos últimos 30 dias.

**Histórico e dados**

- **FR-010**: Toda mudança de status ou observação MUST ser registrada (autor, data/hora, valor anterior,
  valor novo).
- **FR-011**: O sistema MUST registrar a data/hora de finalização e quem finalizou.
- **FR-012**: Registros MUST mostrar a linha do tempo completa ao serem abertos.

**Painel e desempenho**

- **FR-013**: O painel MUST mostrar, para período e unidade escolhidos: recebidos, finalizados, em aberto,
  recusados, taxa de finalização, tempo médio até finalizar, evolução diária e distribuição por status e
  unidade.
- **FR-014**: A tela de desempenho MUST mostrar por profissional: recebidos, finalizados, abertos,
  recusados, taxa, tempo médio e idade do aberto mais antigo, ordenável por coluna.
- **FR-015**: Dentistas MUST ver painel restrito aos próprios dados e MUST NOT ver a comparação entre
  profissionais.

**Experiência e identidade**

- **FR-016**: Todas as telas MUST seguir a nova identidade visual e navegação comum por papel.
- **FR-017**: O formulário público MUST lembrar unidade e profissional no aparelho e manter o foco para
  registros em sequência.
- **FR-018**: Dentista logado MUST poder registrar finalização com o próprio nome pré-definido.
- **FR-019**: Telas MUST funcionar em 360 px sem rolagem horizontal, com contraste AA, foco visível e
  navegação por teclado; modo escuro MUST seguir a preferência do sistema.
- **FR-020**: Após login, cada papel MUST cair na fila; endereços antigos (dashboard.html, admin.html)
  MUST redirecionar para as telas novas.
- **FR-021**: Gestão de usuários MUST manter as capacidades atuais (criar, editar, ativar/inativar,
  redefinir senha, marcar admin).

### Key Entities

- **Finalização**: procedimento a finalizar — unidade, paciente, procedimento, profissional, status,
  observação, registrado em, finalizado em/por, última alteração.
- **Evento de histórico**: mudança em uma finalização — quem, quando, campo, de → para.
- **Usuário**: login, profissional vinculado, unidade, ativo, administrador.
- **Status**: Pendente, Aguardando liberação, Aguardando pagamento (abertos); Finalizado, Recusado
  (encerrados).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O admin finaliza um item a partir da fila com no máximo 2 interações (copiar nome +
  finalizar).
- **SC-002**: A fila fica utilizável em até 2 s após o login.
- **SC-003**: O dentista vê suas pendências sem nenhum clique após o login.
- **SC-004**: Itens com mais de 30 dias em aberto podem ser zerados (finalizados ou recusados) sem
  sair da fila.
- **SC-005**: Painel e desempenho recalculam em até 2 s ao trocar filtros.
- **SC-006**: 100% das telas sem rolagem horizontal em 360 px e sem erros de console.
- **SC-007**: Toda mudança de status feita no sistema aparece no histórico do registro.

## Assumptions

- O nome do produto será "Finaliza Odonto", com a assinatura "AmorSaúde São João del-Rei"; trocável.
- "Recusado" é o termo para itens que não serão finalizados (ex.: fora do prazo de 6 meses, já
  finalizado antes); o motivo é obrigatório e visível ao dentista.
- Itens migrados mantêm seus status; não há data real de finalização para eles.
- O formulário público sem login continua existindo (é como os dentistas registram hoje).
- Período padrão de painel/desempenho: últimos 30 dias, no fuso de Brasília.
- Atualização da fila por consulta periódica é suficiente (não é preciso tempo real instantâneo).
- Unidades continuam sendo SJDR e SJDR APOIO.
