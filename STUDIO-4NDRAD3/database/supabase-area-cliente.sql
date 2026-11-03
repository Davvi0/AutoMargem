-- =====================================================================
-- MARGEM AUTO | Login do cliente + Área do cliente
--
-- COMO USAR
--   1. Rode ANTES o supabase-seguranca.sql (já deve estar aplicado).
--   2. SQL Editor > New query > cole tudo > Run. Pode rodar várias vezes.
--   3. Siga o checklist de configuração no painel do Supabase (README).
--
-- O QUE ESTE SCRIPT FAZ
--   - Cria a tabela "clientes" (perfil: nome e WhatsApp), protegida por RLS:
--     cada cliente só enxerga/edita o próprio perfil.
--   - Cria o perfil automaticamente quando alguém cria conta pelo site.
--   - Adiciona "user_id" em agendamentos: todo agendamento feito POR UMA
--     CONTA LOGADA fica vinculado a ela automaticamente (via gatilho, o
--     cliente não consegue forjar outro dono).
--   - Permite que cliente logado crie agendamento (a política antiga só
--     valia para visitante sem login).
--   - Cria funções seguras para o cliente listar, cancelar e remarcar
--     SOMENTE os próprios agendamentos.
--
-- O QUE NÃO MUDA
--   - A dona continua entrando pelo admin e vendo tudo (política por e-mail).
--   - Clientes NÃO conseguem ler a tabela agendamentos diretamente.
--   - Agendamento como visitante (sem login) continua funcionando.
--
-- REGRAS (altere aqui, e em public/config-site.js, se quiser)
--   - Só cancela/remarca agendamento "confirmado".
--   - Antecedência mínima: 2 horas. Fuso: America/Sao_Paulo.
--   - Cancelar grava status = 'cancelado' (o painel admin já entende).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Perfil do cliente
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
    user_id   uuid primary key references auth.users (id) on delete cascade,
    nome      text not null check (length(trim(nome)) between 1 and 120),
    whatsapp  text not null check (length(whatsapp) between 10 and 13),
    criado_em timestamptz not null default now()
);

alter table public.clientes enable row level security;

drop policy if exists "cliente le o proprio perfil"        on public.clientes;
drop policy if exists "cliente cria o proprio perfil"      on public.clientes;
drop policy if exists "cliente atualiza o proprio perfil"  on public.clientes;

create policy "cliente le o proprio perfil"
    on public.clientes for select to authenticated
    using (user_id = auth.uid());

create policy "cliente cria o proprio perfil"
    on public.clientes for insert to authenticated
    with check (user_id = auth.uid());

create policy "cliente atualiza o proprio perfil"
    on public.clientes for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

revoke all on public.clientes from anon;
grant select, insert, update on public.clientes to authenticated;


-- Cria o perfil quando a conta é criada pelo site (signUp envia nome/whatsapp
-- em "data"). Contas sem tipo = 'cliente' (ex.: a da dona) são ignoradas.
create or replace function public.criar_perfil_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_nome text;
    v_wa   text;
begin
    if coalesce(new.raw_user_meta_data ->> 'tipo', '') <> 'cliente' then
        return new;
    end if;

    v_nome := left(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), 120);
    v_wa   := regexp_replace(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g');

    if v_nome <> '' and length(v_wa) between 10 and 13 then
        insert into public.clientes (user_id, nome, whatsapp)
        values (new.id, v_nome, v_wa)
        on conflict (user_id) do nothing;
    end if;

    return new;   -- nunca bloqueia a criação da conta
end;
$$;

drop trigger if exists criar_perfil_cliente on auth.users;
create trigger criar_perfil_cliente
    after insert on auth.users
    for each row execute function public.criar_perfil_cliente();


-- ---------------------------------------------------------------------
-- 2) Vínculo agendamento <-> conta
-- ---------------------------------------------------------------------
alter table public.agendamentos
    add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists agendamentos_user_idx
    on public.agendamentos (user_id, data);

-- Quem é cliente logado tem o agendamento vinculado a si; todos os outros
-- casos (visitante, painel admin) ficam sem dono. Sobrescreve qualquer valor
-- enviado pelo navegador.
create or replace function public.agendamento_vincular_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null
       and exists (select 1 from public.clientes c where c.user_id = auth.uid()) then
        new.user_id := auth.uid();
    else
        new.user_id := null;
    end if;
    return new;
end;
$$;

drop trigger if exists agendamento_vincular_cliente on public.agendamentos;
create trigger agendamento_vincular_cliente
    before insert on public.agendamentos
    for each row execute function public.agendamento_vincular_cliente();


-- Cliente LOGADO também pode criar agendamento (a política original só
-- cobria o visitante sem login, papel "anon").
drop policy if exists "cliente logado cria agendamento" on public.agendamentos;

create policy "cliente logado cria agendamento"
    on public.agendamentos
    for insert
    to authenticated
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome))         between 1 and 120
        and length(trim(whatsapp))     between 8 and 30
        and length(trim(procedimento)) between 1 and 120
        and exists (select 1 from public.clientes c where c.user_id = auth.uid())
    );


-- ---------------------------------------------------------------------
-- 3) Funções da área do cliente (sempre filtram por auth.uid())
-- ---------------------------------------------------------------------

-- 3.1) Listar os meus agendamentos (últimos 180 dias + futuros)
create or replace function public.cliente_agendamentos()
returns table (
    id           text,
    nome         text,
    procedimento text,
    data         text,
    horario      text,
    status       text
)
language sql
stable
security definer
set search_path = public
as $$
    select a.id::text,
           a.nome::text,
           a.procedimento::text,
           a.data::text,
           left(a.horario::text, 5),
           a.status::text
    from public.agendamentos a
    where auth.uid() is not null
      and a.user_id = auth.uid()
      and a.data::text >= to_char((now() at time zone 'America/Sao_Paulo')::date - 180, 'YYYY-MM-DD')
    order by a.data desc, a.horario desc
    limit 60;
$$;

revoke all on function public.cliente_agendamentos() from public, anon;
grant execute on function public.cliente_agendamentos() to authenticated;


-- 3.2) Cancelar. Retorna: ok | nao_encontrado | indisponivel | prazo
create or replace function public.cliente_cancelar(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    a            public.agendamentos%rowtype;
    quando       timestamp;
    antecedencia interval := interval '2 hours';
begin
    select * into a
    from public.agendamentos x
    where x.id::text = p_id
      and auth.uid() is not null
      and x.user_id = auth.uid();

    if not found then
        return 'nao_encontrado';
    end if;

    if a.status <> 'confirmado' then
        return 'indisponivel';
    end if;

    quando := (a.data::text || ' ' || left(a.horario::text, 5))::timestamp;
    if quando - (now() at time zone 'America/Sao_Paulo') < antecedencia then
        return 'prazo';
    end if;

    update public.agendamentos set status = 'cancelado' where id::text = p_id;
    return 'ok';
end;
$$;

revoke all on function public.cliente_cancelar(text) from public, anon;
grant execute on function public.cliente_cancelar(text) to authenticated;


-- 3.3) Remarcar / editar serviço, data e horário.
--      Retorna: ok | nao_encontrado | indisponivel | prazo | ocupado | invalido
create or replace function public.cliente_remarcar(
    p_id           text,
    p_procedimento text,
    p_data         text,
    p_horario      text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    a            public.agendamentos%rowtype;
    quando_atual timestamp;
    quando_novo  timestamp;
    agora        timestamp := (now() at time zone 'America/Sao_Paulo');
    antecedencia interval := interval '2 hours';
begin
    if p_data !~ '^\d{4}-\d{2}-\d{2}$'
       or p_horario !~ '^\d{2}:\d{2}$'
       or length(trim(coalesce(p_procedimento, ''))) not between 1 and 120 then
        return 'invalido';
    end if;

    select * into a
    from public.agendamentos x
    where x.id::text = p_id
      and auth.uid() is not null
      and x.user_id = auth.uid();

    if not found then
        return 'nao_encontrado';
    end if;

    if a.status <> 'confirmado' then
        return 'indisponivel';
    end if;

    quando_atual := (a.data::text || ' ' || left(a.horario::text, 5))::timestamp;
    if quando_atual - agora < antecedencia then
        return 'prazo';
    end if;

    begin
        quando_novo := (p_data || ' ' || p_horario)::timestamp;
    exception when others then
        return 'invalido';
    end;
    if quando_novo - agora < antecedencia then
        return 'prazo';
    end if;

    if exists (
        select 1 from public.agendamentos o
        where o.data::text = p_data
          and left(o.horario::text, 5) = p_horario
          and o.status = 'confirmado'
          and o.id::text <> p_id
    ) then
        return 'ocupado';
    end if;

    begin
        execute format(
            'update public.agendamentos set data = %L, horario = %L, procedimento = %L where id::text = %L',
            p_data, p_horario, trim(p_procedimento), p_id
        );
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.cliente_remarcar(text, text, text, text) from public, anon;
grant execute on function public.cliente_remarcar(text, text, text, text) to authenticated;
