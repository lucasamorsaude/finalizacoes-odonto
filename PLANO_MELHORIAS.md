# Plano de Melhorias

## 1. Coluna "Unidade" no formulário e tabela

**Escopo:** Adicionar campo antes de "Paciente" com dropdown fixo (SJDR / SJDR APOIO).

### Planilha (Finalizações)
- Inserir coluna "Unidade" como primeira coluna (antes de Paciente).

### codigo.gs
- `doPost`: receber `e.parameter.unidade` e incluir no `appendRow` como primeiro elemento.
- Validar que `unidade` não está vazio.

### index.html / script.js
- Adicionar `<select id="unidade">` com as duas opções antes do campo paciente.
- No `submit`: capturar `unidade` e incluir no `FormData`.

### dashboard.js
- A tabela já renderiza dinamicamente pelos headers da planilha — nenhuma mudança necessária se a coluna existir na sheet.
- Adicionar filtro por unidade no dashboard (select com SJDR / SJDR APOIO / Todos), enviar como `queryParam` e filtrar no `doGet`.

---

## 2. Profissionais dinâmicos no formulário

**Problema:** Lista hardcoded em `script.js` — qualquer mudança exige deploy.

**Solução:** Carregar da aba `Usuarios` via `getProfissionais` (já existe no backend).

### script.js
- Remover array `profissionais` hardcoded.
- Na `DOMContentLoaded`, fazer fetch `?action=getProfissionais` e popular o `datalist` dinamicamente (igual ao que `dashboard.js` já faz com `getProfissionaisFilter`).
- Guardar a lista retornada em variável para validação no submit.

### Resultado
Adicionar/inativar profissional na aba `Usuarios` reflete automaticamente no formulário — zero mudança de código.

---

## 3. Painel Admin — Gestão de Usuários e Profissionais

### Estrutura da aba `Usuarios` (ajuste necessário)
Adicionar coluna `Ativo` (TRUE/FALSE) e opcionalmente `Unidade` por usuário.

| Usuário | Senha | Profissional | Ativo | Unidade |
|---------|-------|-------------|-------|---------|

### Novas actions no codigo.gs

| Action | Método | Descrição |
|--------|--------|-----------|
| `getUsuarios` | GET | Retorna todos os usuários (só admin) |
| `createUsuario` | POST | Cria novo usuário |
| `updateUsuario` | POST | Edita usuário existente |
| `toggleUsuario` | POST | Ativa/inativa (altera coluna Ativo) |

- Todas as actions admin validam que `usernameLogado` é admin antes de executar.
- `handleLogin` passa a verificar coluna `Ativo === TRUE` para bloquear usuários inativos.
- `getProfissionais` filtra apenas usuários com `Ativo === TRUE`.

### Frontend — admin.html + admin.js (nova página)

- Link "Admin" visível apenas se `loggedInUser === 'admin'` no dashboard.
- Tabela listando usuários com botões: **Editar** / **Ativar-Inativar**.
- Modal/formulário inline para criar ou editar usuário (campos: Usuário, Senha, Profissional, Unidade).
- Sem necessidade de alterar código para gerenciar profissionais — inativar usuário remove o profissional do dropdown automaticamente.

---

## Ordem de execução sugerida

1. **Planilha:** inserir coluna Unidade em Finalizações + coluna Ativo em Usuarios.
2. **codigo.gs:** atualizar `doPost`, `doGet` (filtro unidade), `handleLogin` (verifica Ativo), adicionar actions admin.
3. **script.js:** profissionais dinâmicos.
4. **index.html:** campo Unidade no formulário.
5. **dashboard.js / dashboard.html:** filtro Unidade.
6. **admin.html + admin.js:** painel de gestão.
