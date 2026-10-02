# Contrato: telas e navegação

| Endereço | Papel | Conteúdo | Requisitos |
|---|---|---|---|
| `index.html` | público | Formulário de registro (lembra unidade/profissional) | FR-017 |
| `login.html?volta=<tela>` | público | Login; após sucesso vai para `volta` ou `fila.html` | FR-020 |
| `fila.html` | admin, profissional | Fila de itens abertos (admin: ações; profissional: leitura + recusados 30 dias) | FR-001…009 |
| `painel.html` | admin, profissional | Indicadores, série, faixas de idade, por unidade | FR-013, FR-015 |
| `desempenho.html` | admin | Tabela + gráfico por profissional; detalhe semanal | FR-014 |
| `registros.html` | admin, profissional | Consulta completa, detalhe com linha do tempo, CSV (admin) | FR-010…012 |
| `usuarios.html` | admin | Gestão de usuários | FR-021 |
| `dashboard.html` | — | Redireciona para `fila.html` | FR-020 |
| `admin.html` | — | Redireciona para `usuarios.html` | FR-020 |

## Parâmetros de URL (links compartilháveis)

- `fila.html?profissional=<nome>&unidade=<u>&status=<s>`
- `registros.html?profissional=<nome>&id=<id>` (abre o detalhe)
- `painel.html?periodo=7|30|90|365&unidade=<u>`

## Layout comum (telas autenticadas)

- Barra lateral (desktop) / barra inferior + menu (celular): logo, itens do papel, contador de itens
  na fila, botão "Nova finalização", usuário + sair.
- Itens: Fila · Painel · Desempenho (admin) · Registros · Usuários (admin).
- Sessão inválida/expirada → `login.html?volta=<tela atual>`.

## Componentes compartilhados

- **Nome copiável**: botão com o nome do paciente; clique/Enter copia, mostra "Copiado" por 2 s;
  fallback seleciona o texto.
- **Toast**: mensagens curtas; variante com ação ("Desfazer").
- **Modal**: foco preso, Esc fecha, devolve foco ao gatilho.
- **Chip de status**: ícone + rótulo (nunca só cor).
- **Estados**: esqueleto na 1ª carga; recarga mantém o conteúdo com opacidade reduzida; vazio com
  mensagem; erro com "Tentar de novo".
