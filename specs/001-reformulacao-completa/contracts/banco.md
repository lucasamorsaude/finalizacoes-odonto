# Contrato: interface do banco (PostgREST / RPC)

Todas as funções `security invoker` respeitam RLS (o profissional só agrega os próprios dados), exceto
onde indicado. Datas em `timestamptz`; o front envia limites já convertidos do fuso de Brasília.

## Tabelas acessadas diretamente

| Operação | Quem | Forma |
|---|---|---|
| Listar fila | autenticado | `GET finalizacoes?status=in.(abertos)&order=created_at.asc,id.asc` + filtros, `Range` 100, `count=exact` |
| Listar registros | autenticado | `GET finalizacoes` + filtros, paginação 50 |
| Alterar status/observação (1 ou lote) | admin | `PATCH finalizacoes?id=in.(…)` body `{status, observacao}` → retorna linhas alteradas |
| Excluir registro | admin | `DELETE finalizacoes?id=eq.X` (usado só pelos testes e2e) |
| Histórico de um registro | autenticado | `GET finalizacao_eventos?finalizacao_id=eq.X&order=em.asc` |
| Usuários | admin (todos) / profissional (a si) | `GET/PATCH usuarios` (colunas: profissional, unidade, ativo, is_admin) |

Erros esperados: `Recusado` sem observação → violação de check (`23514`), mensagem amigável no front.

## Funções (RPC)

### `listar_profissionais() → setof text` — anônimo
Nomes de profissionais ativos (não admin), ordenados.

### `registrar_finalizacao(p_unidade, p_paciente, p_procedimento, p_profissional) → bigint` — anônimo/autenticado
- Profissional precisa estar ativo.
- Não força o nome do chamador: o registro anônimo já permite qualquer profissional ativo, então
  isso não acrescentaria segurança. Na "Nova finalização" do dentista a interface fixa o nome dele;
  o formulário público usa um cliente sem sessão para nunca herdar o login de quem está no computador.

### `profissionais_registrados() → setof text` — autenticado
Nomes distintos presentes em `finalizacoes` (para filtros).

### `resumo_fila(p_unidade, p_profissional, p_paciente, p_idade_min_dias, p_idade_max_dias) → table(status text, total bigint)` — autenticado
Contagem por status **dos itens abertos** com os mesmos filtros da fila.

### `resumo_status(p_unidade, p_profissional, p_paciente, p_de, p_ate, p_status_abertos boolean)` — autenticado
Mantida (consulta de registros): contagem por status com filtros.

### `painel_indicadores(p_de, p_ate, p_unidade, p_profissional) → json` — autenticado
```json
{
  "recebidos": 812, "finalizados": 701, "em_aberto": 88, "recusados": 23,
  "taxa_finalizacao": 0.863,
  "tempo_medio_horas": 31.5, "tempo_medio_amostra": 120, "tempo_medio_desde": "2026-10-02",
  "aberto_agora": { "total": 353, "ate_7": 53, "de_7_a_30": 55, "de_30_a_90": 150, "acima_90": 95 },
  "por_unidade": [{ "unidade": "SJDR", "recebidos": 540 }, { "unidade": "SJDR APOIO", "recebidos": 272 }]
}
```
`aberto_agora` ignora o período (estado atual), respeita unidade/profissional.

### `painel_serie(p_de, p_ate, p_unidade, p_profissional) → table(inicio date, finalizados int, em_aberto int, recusados int)` — autenticado
Agrupado por dia se `p_ate − p_de ≤ 45 dias`, senão por semana (segunda-feira). Situação **atual** dos
recebidos em cada intervalo. Intervalos sem registros vêm com zeros (série contínua).

### `desempenho_profissionais(p_de, p_ate, p_unidade) → table(...)` — **somente admin** (erro para outros)
`profissional, recebidos, finalizados, em_aberto, recusados, taxa_finalizacao, tempo_medio_horas,
aberto_mais_antigo (timestamptz)`; `em_aberto`/`aberto_mais_antigo` refletem o estado atual dos
recebidos no período.

### `desempenho_semanal(p_profissional, p_semanas int default 12) → table(inicio date, recebidos int, finalizados int)` — somente admin
Evolução semanal de um profissional (detalhe).
