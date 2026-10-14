-- 003 — Status Arquivado: lançamentos errados ou de profissionais que saíram.
-- Só a administração vê; não conta no painel nem no desempenho.
-- Aplicar com: node scripts/aplicar-migracao.mjs supabase/migrations/003_arquivado.sql

alter table public.finalizacoes drop constraint finalizacoes_status_check;
alter table public.finalizacoes add constraint finalizacoes_status_check
    check (status in ('Pendente', 'Aguardando liberação', 'Aguardando pagamento', 'Finalizado', 'Recusado', 'Arquivado'));

-- ── RLS: profissional não vê os próprios itens arquivados ─────────────────

drop policy "ler finalizacoes" on public.finalizacoes;
create policy "ler finalizacoes" on public.finalizacoes for select to authenticated
    using (
        (select public.eh_admin())
        or (profissional = (select public.meu_profissional()) and status <> 'Arquivado')
    );

drop policy "ler eventos" on public.finalizacao_eventos;
create policy "ler eventos" on public.finalizacao_eventos for select to authenticated
    using (
        (select public.eh_admin())
        or exists (
            select 1 from public.finalizacoes f
            where f.id = finalizacao_id
              and f.profissional = (select public.meu_profissional())
              and f.status <> 'Arquivado'
        )
    );

-- ── Painel e desempenho ignoram arquivados ─────────────────────────────────

create or replace function public.painel_indicadores(
    p_de timestamptz,
    p_ate timestamptz,
    p_unidade text default null,
    p_profissional text default null
) returns json
language sql stable security invoker set search_path = public as $$
    with base as (
        select * from finalizacoes f
        where f.status <> 'Arquivado'
          and (p_unidade is null or f.unidade = p_unidade)
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

create or replace function public.painel_serie(
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
          and f.status <> 'Arquivado'
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

create or replace function public.desempenho_profissionais(
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
      and f.status <> 'Arquivado'
      and (p_unidade is null or f.unidade = p_unidade)
    group by f.profissional
    order by count(*) desc
$$;

create or replace function public.desempenho_semanal(
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
          and f.status <> 'Arquivado'
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
