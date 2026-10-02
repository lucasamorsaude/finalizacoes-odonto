-- Esquema do banco — rodar uma vez no SQL Editor do Supabase.
-- Segurança: toda regra de acesso fica aqui (RLS). A chave pública do site
-- não dá acesso a nada além do que estas políticas permitem.

-- ── Tabelas ────────────────────────────────────────────────────────────────

create table public.usuarios (
    id           uuid primary key references auth.users on delete cascade,
    username     text not null unique,
    profissional text not null,
    unidade      text check (unidade in ('SJDR', 'SJDR APOIO')),
    ativo        boolean not null default true,
    is_admin     boolean not null default false,
    created_at   timestamptz not null default now()
);

create table public.finalizacoes (
    id           bigint generated always as identity primary key,
    unidade      text not null check (unidade in ('SJDR', 'SJDR APOIO')),
    paciente     text not null check (length(trim(paciente)) between 1 and 200),
    procedimento text not null check (length(trim(procedimento)) between 1 and 2000),
    profissional text not null,
    status       text not null default 'Pendente'
                 check (status in ('Pendente', 'Aguardando liberação', 'Aguardando pagamento', 'Finalizado')),
    observacao   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz,
    updated_by   uuid references auth.users on delete set null
);

create index finalizacoes_created_at_idx on public.finalizacoes (created_at desc);
create index finalizacoes_profissional_idx on public.finalizacoes (profissional, created_at desc);
create index finalizacoes_status_idx on public.finalizacoes (status);

-- Registra quem alterou e quando
create function public.marcar_atualizacao() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    new.updated_by := auth.uid();
    return new;
end $$;

create trigger finalizacoes_atualizacao
    before update on public.finalizacoes
    for each row execute function public.marcar_atualizacao();

-- ── Helpers de permissão ───────────────────────────────────────────────────
-- security definer: leem usuarios ignorando RLS (evita recursão nas políticas)

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from usuarios where id = auth.uid() and ativo and is_admin)
$$;

create function public.meu_profissional() returns text
language sql stable security definer set search_path = public as $$
    select profissional from usuarios where id = auth.uid() and ativo
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.usuarios enable row level security;
alter table public.finalizacoes enable row level security;

-- Profissional vê só os próprios registros; admin vê tudo
create policy "ler finalizacoes" on public.finalizacoes for select to authenticated
    using ((select public.eh_admin()) or profissional = (select public.meu_profissional()));

create policy "admin atualiza finalizacoes" on public.finalizacoes for update to authenticated
    using ((select public.eh_admin())) with check ((select public.eh_admin()));

create policy "admin exclui finalizacoes" on public.finalizacoes for delete to authenticated
    using ((select public.eh_admin()));

create policy "ler usuarios" on public.usuarios for select to authenticated
    using (id = auth.uid() or (select public.eh_admin()));

create policy "admin atualiza usuarios" on public.usuarios for update to authenticated
    using ((select public.eh_admin())) with check ((select public.eh_admin()));

-- Privilégios por coluna: inserção só via função (formulário) ou Edge Function (usuários)
revoke all on public.finalizacoes, public.usuarios from anon, authenticated;
grant select, delete on public.finalizacoes to authenticated;
grant update (status, observacao) on public.finalizacoes to authenticated;
grant select on public.usuarios to authenticated;
grant update (profissional, unidade, ativo, is_admin) on public.usuarios to authenticated;

-- ── Funções chamadas pelo site ─────────────────────────────────────────────

-- Formulário público: lista de profissionais ativos (só nomes)
create function public.listar_profissionais() returns setof text
language sql stable security definer set search_path = public as $$
    select distinct profissional from usuarios
    where ativo and not is_admin
    order by profissional
$$;

-- Formulário público: registra finalização validando o profissional
create function public.registrar_finalizacao(
    p_unidade text, p_paciente text, p_procedimento text, p_profissional text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
    novo_id bigint;
begin
    if not exists (select 1 from usuarios where profissional = p_profissional and ativo and not is_admin) then
        raise exception 'Profissional inválido. Selecione um da lista.';
    end if;

    insert into finalizacoes (unidade, paciente, procedimento, profissional)
    values (p_unidade, trim(p_paciente), trim(p_procedimento), p_profissional)
    returning id into novo_id;

    return novo_id;
end $$;

-- Dashboard: profissionais que já têm registros (respeita RLS)
create function public.profissionais_registrados() returns setof text
language sql stable security invoker set search_path = public as $$
    select distinct profissional from finalizacoes order by profissional
$$;

-- Dashboard: contagem por status com os mesmos filtros da listagem (respeita RLS)
create function public.resumo_status(
    p_unidade text default null,
    p_profissional text default null,
    p_paciente text default null,
    p_de timestamptz default null,
    p_ate timestamptz default null
) returns table (status text, total bigint)
language sql stable security invoker set search_path = public as $$
    select f.status, count(*) from finalizacoes f
    where (p_unidade is null or f.unidade = p_unidade)
      and (p_profissional is null or f.profissional = p_profissional)
      and (p_paciente is null or f.paciente ilike '%' || p_paciente || '%')
      and (p_de is null or f.created_at >= p_de)
      and (p_ate is null or f.created_at < p_ate)
    group by f.status
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.listar_profissionais() to anon, authenticated;
grant execute on function public.registrar_finalizacao(text, text, text, text) to anon, authenticated;
grant execute on function public.profissionais_registrados() to authenticated;
grant execute on function public.resumo_status(text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.eh_admin(), public.meu_profissional() to authenticated;
