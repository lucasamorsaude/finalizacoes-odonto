# Data Model: Reformulação completa

## finalizacoes (alterada)

| Campo | Tipo | Regra |
|---|---|---|
| id | bigint identity | PK |
| unidade | text | `SJDR` \| `SJDR APOIO` |
| paciente | text | 1–200 caracteres |
| procedimento | text | 1–2000 caracteres |
| profissional | text | nome do profissional (vínculo por nome, como hoje) |
| status | text | ver estados abaixo; padrão `Pendente` |
| observacao | text null | **obrigatória** quando `status = 'Recusado'` |
| created_at | timestamptz | data de registro |
| updated_at / updated_by | timestamptz / uuid | última alteração (trigger) |
| **finalizado_em** | timestamptz null | **novo** — definido ao entrar em `Finalizado`; limpo ao sair |
| **finalizado_por** | uuid null | **novo** — quem finalizou |

Índices novos: `(status, created_at)` para a fila; `(finalizado_em)` para tempo médio.

### Estados

```text
                ┌───────────── abertos (fila) ─────────────┐
 registro ──▶  Pendente ◀──▶ Aguardando liberação ◀──▶ Aguardando pagamento
                   │                 │                         │
                   ▼                 ▼                         ▼
              Finalizado  ◀──────────┴─────────────▶  Recusado (motivo obrigatório)
                   └──── admin pode reabrir (volta a um estado aberto) ────┘
```

Qualquer transição é permitida a admin; toda transição gera evento.

## finalizacao_eventos (nova)

| Campo | Tipo | Regra |
|---|---|---|
| id | bigint identity | PK |
| finalizacao_id | bigint | FK → finalizacoes(id) on delete cascade |
| autor | uuid null | `auth.uid()` de quem alterou |
| autor_nome | text null | `usuarios.profissional` do autor no momento (legível mesmo se o usuário sair) |
| em | timestamptz | `now()` |
| status_de / status_para | text null | preenchidos quando o status mudou |
| observacao_de / observacao_para | text null | preenchidos quando a observação mudou |

Inserida apenas pelo trigger (`security definer`); ninguém insere/edita/apaga pela API.
Leitura: admin vê tudo; profissional vê eventos dos registros que ele pode ver.

## usuarios (sem mudança estrutural)

`id, username, profissional, unidade, ativo, is_admin, created_at`.

## Regras de acesso (RLS) — resumo

| Recurso | Anônimo | Profissional | Admin |
|---|---|---|---|
| finalizacoes — ler | — | só `profissional = o seu` | tudo |
| finalizacoes — status/observação | — | — | sim |
| finalizacoes — registrar | via `registrar_finalizacao` | via função (interface fixa o próprio nome) | via função |
| finalizacao_eventos — ler | — | dos seus registros | tudo |
| usuarios — ler | — | a própria linha | tudo |
| funções de painel | — | restritas aos seus dados | tudo |
| desempenho por profissional | — | negado | sim |
