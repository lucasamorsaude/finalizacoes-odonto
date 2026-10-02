-- 002 — Reformulação: status Recusado, data de finalização, histórico, fila, painel e desempenho.
-- Aplicar com: node scripts/aplicar-migracao.mjs supabase/migrations/002_reformulacao.sql

-- ── Status Recusado (motivo obrigatório) ───────────────────────────────────

alter table public.finalizacoes drop constraint finalizacoes_status_check;
alter table public.finalizacoes add constraint finalizacoes_status_check
    check (status in ('Pendente', 'Aguardando liberação', 'Aguardando pagamento', 'Finalizado', 'Recusado'));
alter table public.finalizacoes add constraint finalizacoes_motivo_recusa
    check (status <> 'Recusado' or length(trim(coalesce(observacao, ''))) > 0);

-- Itens abertos = os que estão na fila
create function public.status_aberto(p_status text) returns boolean
language sql immutable as $$
    select p_status in ('Pendente', 'Aguardando liberação', 'Aguardando pagamento')
$$;

-- ── Data de finalização ────────────────────────────────────────────────────

alter table public.finalizacoes
    add column finalizado_em timestamptz,
    add column finalizado_por uuid references auth.users on delete set null;

create index finalizacoes_fila_idx on public.finalizacoes (created_at, id)
    where status in ('Pendente', 'Aguardando liberação', 'Aguardando pagamento');
create index finalizacoes_finalizado_em_idx on public.finalizacoes (finalizado_em)
    where finalizado_em is not null;

create or replace function public.marcar_atualizacao() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    new.updated_by := auth.uid();
    if new.status = 'Finalizado' and old.status is distinct from 'Finalizado' then
        new.finalizado_em := now();
        new.finalizado_por := auth.uid();
    elsif new.status <> 'Finalizado' then
        new.finalizado_em := null;
        new.finalizado_por := null;
    end if;
    return new;
end $$;

-- ── Histórico de alterações ────────────────────────────────────────────────

create table public.finalizacao_eventos (
    id              bigint generated always as identity primary key,
    finalizacao_id  bigint not null references public.finalizacoes on delete cascade,
    autor           uuid references auth.users on delete set null,
    autor_nome      text,
    em              timestamptz not null default now(),
    status_de       text,
    status_para     text,
    observacao_de   text,
    observacao_para text
);

create index finalizacao_eventos_finalizacao_idx on public.finalizacao_eventos (finalizacao_id, em);

-- security definer: grava o evento mesmo sem permissão de insert do usuário
create function public.registrar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    mudou_status boolean := new.status is distinct from old.status;
    mudou_obs boolean := new.observacao is distinct from old.observacao;
begin
    if mudou_status or mudou_obs then
        insert into finalizacao_eventos
            (finalizacao_id, autor, autor_nome, status_de, status_para, observacao_de, observacao_para)
        values (
            new.id,
            auth.uid(),
            (select case when is_admin then initcap(username) else profissional end
             from usuarios where id = auth.uid()),
            case when mudou_status then old.status end,
            case when mudou_status then new.status end,
            case when mudou_obs then old.observacao end,
            case when mudou_obs then new.observacao end
        );
    end if;
    return null;
end $$;

create trigger finalizacoes_evento
    after update on public.finalizacoes
    for each row execute function public.registrar_evento();

alter table public.finalizacao_eventos enable row level security;

create policy "ler eventos" on public.finalizacao_eventos for select to authenticated
    using (
        (select public.eh_admin())
        or exists (
            select 1 from public.finalizacoes f
            where f.id = finalizacao_id and f.profissional = (select public.meu_profissional())
        )
    );

revoke all on public.finalizacao_eventos from anon, authenticated;
grant select on public.finalizacao_eventos to authenticated;

-- ── Helpers ────────────────────────────────────────────────────────────────

create function public.exigir_admin() returns void
language plpgsql stable as $$
begin
    if not public.eh_admin() then
        raise exception 'Acesso restrito a administradores.' using errcode = '42501';
    end if;
end $$;

-- ── Fila ───────────────────────────────────────────────────────────────────

-- Contagem por status dos itens abertos, com os mesmos filtros da fila (respeita RLS)
create function public.resumo_fila(
    p_unidade text default null,
    p_profissional text default null,
    p_paciente text default null,
    p_idade_min integer default null,
    p_idade_max integer default null
) returns table (status text, total bigint)
language sql stable security invoker set search_path = public as $$
    select f.status, count(*) from finalizacoes f
    where status_aberto(f.status)
      and (p_unidade is null or f.unidade = p_unidade)
      and (p_profissional is null or f.profissional = p_profissional)
      and (p_paciente is null or f.paciente ilike '%' || p_paciente || '%')
      and (p_idade_min is null or f.created_at <= now() - make_interval(days => p_idade_min))
      and (p_idade_max is null or f.created_at > now() - make_interval(days => p_idade_max))
    group by f.status
$$;

-- ── Painel ─────────────────────────────────────────────────────────────────
-- Coorte = registros recebidos no período; números refletem a situação atual desses registros.

create function public.painel_indicadores(
    p_de timestamptz,
    p_ate timestamptz,
    p_unidade text default null,
    p_profissional text default null
) returns json
language sql stable security invoker set search_path = public as $$
    with base as (
        select * from finalizacoes f
        where (p_unidade is null or f.unidade = p_unidade)
          and (p_profissional is null or f.profissional = p_profissional)
    ),
    periodo as (select * from base where created_at >= p_de and created_at < p_ate),
    abertos as (select * from base where status_aberto(status)),
    tempos as (
        select extract(epoch from finalizado_em - created_at) / 3600 as horas
        from periodo where finalizado_em is not null
    )
    select json_build_object(
        'recebidos',        (select count(*) from periodo),
        'finalizados',      (select count(*) from periodo where status = 'Finalizado'),
        'em_aberto',        (select count(*) from periodo where status_aberto(status)),
        'recusados',        (select count(*) from periodo where status = 'Recusado'),
        'taxa_finalizacao', (select round(count(*) filter (where status = 'Finalizado')::numeric
                                          / nullif(count(*), 0), 4) from periodo),
        'tempo_medio_horas',   (select round(avg(horas)::numeric, 1) from tempos),
        'tempo_mediano_horas', (select round((percentile_cont(0.5) within group (order by horas))::numeric, 1) from tempos),
        'tempo_medio_amostra', (select count(*) from tempos),
        'tempo_medio_desde',   (select min(finalizado_em)::date from finalizacoes where finalizado_em is not null),
        'aberto_agora', (
            select json_build_object(
                'total',      count(*),
                'ate_7',      count(*) filter (where created_at > now() - interval '7 days'),
                'de_7_a_30',  count(*) filter (where created_at <= now() - interval '7 days'
                                                and created_at > now() - interval '30 days'),
                'de_30_a_90', count(*) filter (where created_at <= now() - interval '30 days'
                                                and created_at > now() - interval '90 days'),
                'acima_90',   count(*) filter (where created_at <= now() - interval '90 days'),
                'mais_antigo', min(created_at)
            ) from abertos
        ),
        'por_unidade', (
            select coalesce(json_agg(json_build_object(
                'unidade', unidade, 'recebidos', recebidos, 'finalizados', finalizados,
                'em_aberto', em_aberto, 'recusados', recusados) order by unidade), '[]'::json)
            from (
                select unidade,
                       count(*) as recebidos,
                       count(*) filter (where status = 'Finalizado') as finalizados,
                       count(*) filter (where status_aberto(status)) as em_aberto,
                       count(*) filter (where status = 'Recusado') as recusados
                from periodo group by unidade
            ) u
        )
    )
$$;

-- Série por dia (período ≤ 45 dias) ou por semana, no fuso de Brasília, sem buracos
create function public.painel_serie(
    p_de timestamptz,
    p_ate timestamptz,
    p_unidade text default null,
    p_profissional text default null
) returns table (inicio date, finalizados bigint, em_aberto bigint, recusados bigint)
language sql stable security invoker set search_path = public as $$
    with params as (
        select case when p_ate - p_de <= interval '45 days' then 'day' else 'week' end as passo
    ),
    intervalos as (
        select generate_series(
            date_trunc(passo, p_de at time zone 'America/Sao_Paulo'),
            (p_ate - interval '1 second') at time zone 'America/Sao_Paulo',
            ('1 ' || passo)::interval
        )::date as inicio
        from params
    ),
    dados as (
        select date_trunc((select passo from params), f.created_at at time zone 'America/Sao_Paulo')::date as inicio,
               f.status
        from finalizacoes f
        where f.created_at >= p_de and f.created_at < p_ate
          and (p_unidade is null or f.unidade = p_unidade)
          and (p_profissional is null or f.profissional = p_profissional)
    )
    select i.inicio,
           count(d.status) filter (where d.status = 'Finalizado'),
           count(d.status) filter (where status_aberto(d.status)),
           count(d.status) filter (where d.status = 'Recusado')
    from intervalos i
    left join dados d on d.inicio = i.inicio
    group by i.inicio
    order by i.inicio
$$;

-- ── Desempenho por profissional (somente admin) ────────────────────────────

create function public.desempenho_profissionais(
    p_de timestamptz,
    p_ate timestamptz,
    p_unidade text default null
) returns table (
    profissional text, recebidos bigint, finalizados bigint, em_aberto bigint, recusados bigint,
    taxa_finalizacao numeric, tempo_medio_horas numeric, aberto_mais_antigo timestamptz, ativo boolean
)
language sql stable security invoker set search_path = public as $$
    select exigir_admin();
    select f.profissional,
           count(*),
           count(*) filter (where f.status = 'Finalizado'),
           count(*) filter (where status_aberto(f.status)),
           count(*) filter (where f.status = 'Recusado'),
           round(count(*) filter (where f.status = 'Finalizado')::numeric / nullif(count(*), 0), 4),
           round((avg(extract(epoch from f.finalizado_em - f.created_at) / 3600)
                  filter (where f.finalizado_em is not null))::numeric, 1),
           min(f.created_at) filter (where status_aberto(f.status)),
           exists (select 1 from usuarios u where u.profissional = f.profissional and u.ativo)
    from finalizacoes f
    where f.created_at >= p_de and f.created_at < p_ate
      and (p_unidade is null or f.unidade = p_unidade)
    group by f.profissional
    order by count(*) desc
$$;

create function public.desempenho_semanal(
    p_profissional text,
    p_semanas integer default 12
) returns table (inicio date, recebidos bigint, finalizados bigint, em_aberto bigint, recusados bigint)
language sql stable security invoker set search_path = public as $$
    select exigir_admin();
    with semanas as (
        select generate_series(
            date_trunc('week', now() at time zone 'America/Sao_Paulo') - make_interval(weeks => p_semanas - 1),
            date_trunc('week', now() at time zone 'America/Sao_Paulo'),
            interval '1 week'
        )::date as inicio
    ),
    dados as (
        select date_trunc('week', f.created_at at time zone 'America/Sao_Paulo')::date as inicio, f.status
        from finalizacoes f
        where f.profissional = p_profissional
          and f.created_at >= date_trunc('week', now()) - make_interval(weeks => p_semanas)
    )
    select s.inicio,
           count(d.status),
           count(d.status) filter (where d.status = 'Finalizado'),
           count(d.status) filter (where status_aberto(d.status)),
           count(d.status) filter (where d.status = 'Recusado')
    from semanas s
    left join dados d on d.inicio = s.inicio
    group by s.inicio
    order by s.inicio
$$;

-- ── Permissões de execução ─────────────────────────────────────────────────
-- O Supabase concede execute em funções novas a anon/authenticated; recomeça do zero.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.listar_profissionais() to anon, authenticated;
grant execute on function public.registrar_finalizacao(text, text, text, text) to anon, authenticated;

grant execute on function
    public.eh_admin(),
    public.meu_profissional(),
    public.status_aberto(text),
    public.exigir_admin(),
    public.profissionais_registrados(),
    public.resumo_status(text, text, text, timestamptz, timestamptz),
    public.resumo_fila(text, text, text, integer, integer),
    public.painel_indicadores(timestamptz, timestamptz, text, text),
    public.painel_serie(timestamptz, timestamptz, text, text),
    public.desempenho_profissionais(timestamptz, timestamptz, text),
    public.desempenho_semanal(text, integer)
to authenticated;
