-- =====================================================================
-- MARGEM AUTO | Profissionais (4) + agenda por profissional
-- Rode DEPOIS dos outros scripts. Pode rodar várias vezes.
-- Cada profissional tem a própria agenda: o mesmo horário pode ser
-- reservado por até 4 clientes, um para cada profissional.
-- =====================================================================

-- 1) Coluna do profissional
alter table public.agendamentos add column if not exists profissional text;

-- 2) Antes: 1 confirmado por dia+horário. Agora: 1 por dia+horário+profissional.
drop index if exists public.agendamentos_data_horario_confirmado_uk;
create unique index if not exists agendamentos_data_horario_prof_confirmado_uk
    on public.agendamentos (data, horario, profissional)
    where status = 'confirmado' and profissional is not null;

-- 3) Horários ocupados (de um profissional; sem profissional = todos).
--    Agendamentos antigos, sem profissional, bloqueiam o horário para todos.
drop function if exists public.horarios_ocupados(text);
create or replace function public.horarios_ocupados(data_consulta text, p_profissional text default null)
returns table (horario text)
language sql
stable
security definer
set search_path = public
as $$
    select left(a.horario::text, 5)
    from public.agendamentos a
    where a.data::text = data_consulta
      and a.status = 'confirmado'
      and (p_profissional is null
           or a.profissional is null
           or a.profissional = p_profissional);
$$;
revoke all on function public.horarios_ocupados(text, text) from public;
grant execute on function public.horarios_ocupados(text, text) to anon, authenticated;

-- 4) Políticas de insert exigem o profissional
drop policy if exists "site publico cria agendamento" on public.agendamentos;
create policy "site publico cria agendamento"
    on public.agendamentos for insert to anon
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome))         between 1 and 120
        and length(trim(whatsapp))     between 8 and 30
        and length(trim(procedimento)) between 1 and 120
        and length(trim(coalesce(profissional, ''))) between 1 and 60
    );

drop policy if exists "cliente logado cria agendamento" on public.agendamentos;
create policy "cliente logado cria agendamento"
    on public.agendamentos for insert to authenticated
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome))         between 1 and 120
        and length(trim(whatsapp))     between 8 and 30
        and length(trim(procedimento)) between 1 and 120
        and length(trim(coalesce(profissional, ''))) between 1 and 60
        and exists (select 1 from public.clientes c where c.user_id = auth.uid())
    );

-- 5) Agendar logado (função segura), agora com profissional
drop function if exists public.criar_agendamento(text, text, text, text, text);
create or replace function public.criar_agendamento(
    p_nome         text,
    p_whatsapp     text,
    p_procedimento text,
    p_profissional text,
    p_data         text,
    p_horario      text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wa text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
begin
    if auth.uid() is null then
        return 'login';
    end if;

    if length(trim(coalesce(p_nome, '')))         not between 1 and 120
       or length(trim(coalesce(p_procedimento, ''))) not between 1 and 120
       or length(trim(coalesce(p_profissional, ''))) not between 1 and 60
       or length(v_wa) not between 10 and 13
       or p_data    !~ '^\d{4}-\d{2}-\d{2}$'
       or p_horario !~ '^\d{2}:\d{2}$' then
        return 'invalido';
    end if;

    insert into public.clientes (user_id, nome, whatsapp)
    values (auth.uid(), left(trim(p_nome), 120), v_wa)
    on conflict (user_id) do nothing;

    begin
        execute format(
            'insert into public.agendamentos (nome, whatsapp, procedimento, profissional, data, horario, status, user_id) values (%L, %L, %L, %L, %L, %L, %L, %L)',
            trim(p_nome), v_wa, trim(p_procedimento), trim(p_profissional), p_data, p_horario, 'confirmado', auth.uid()
        );
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;
revoke all on function public.criar_agendamento(text, text, text, text, text, text) from public, anon;
grant execute on function public.criar_agendamento(text, text, text, text, text, text) to authenticated;

-- 6) Lista do cliente, agora com profissional (muda o tipo de retorno)
drop function if exists public.cliente_agendamentos();
create or replace function public.cliente_agendamentos()
returns table (
    id           text,
    nome         text,
    procedimento text,
    profissional text,
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
           a.profissional::text,
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

-- 7) Remarcar: o horário só pode estar livre PARA O MESMO PROFISSIONAL
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

    if not found then return 'nao_encontrado'; end if;
    if a.status <> 'confirmado' then return 'indisponivel'; end if;

    quando_atual := (a.data::text || ' ' || left(a.horario::text, 5))::timestamp;
    if quando_atual - agora < antecedencia then return 'prazo'; end if;

    begin
        quando_novo := (p_data || ' ' || p_horario)::timestamp;
    exception when others then
        return 'invalido';
    end;
    if quando_novo - agora < antecedencia then return 'prazo'; end if;

    if exists (
        select 1 from public.agendamentos o
        where o.data::text = p_data
          and left(o.horario::text, 5) = p_horario
          and o.status = 'confirmado'
          and o.id::text <> p_id
          and (a.profissional is null or o.profissional is null or o.profissional = a.profissional)
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
