-- =====================================================================
-- MARGEM AUTO | Remove "profissionais": 1 agenda única + 1 preço por serviço
--
-- COMO USAR
--   1. Rode DEPOIS de todos os scripts anteriores (seguranca, area-cliente,
--      profissionais, precos, v2-clientes-precos, margem-auto e
--      login-obrigatorio). Usa public.eh_admin() e servicos_precos.
--   2. Supabase > SQL Editor > New query > cole tudo > Run.
--   3. Pode rodar mais de uma vez (idempotente). NÃO apaga nenhum dado.
--
-- O QUE FAZ
--   a) servicos_precos passa a ser a ÚNICA tabela de preço (nome, preco,
--      disponivel). Os preços que já estavam em servicos_profissionais são
--      copiados para ela (veja o aviso do passo 2).
--   b) Agenda única: só 1 agendamento confirmado por dia + horário.
--   c) criar_agendamento passa a ter 5 parâmetros (sem profissional).
--   d) cliente_remarcar e vincular_veiculo_agendamento sem profissional.
--   e) Funções públicas novas: servicos_catalogo() e preco_servico().
--   f) Valor do agendamento continua congelado no momento da criação.
--
-- NÃO MUDA: agendamentos antigos (a coluna "profissional" continua lá, só
-- como histórico), valores já gravados, clientes, veículos, despesas.
-- As tabelas/funções antigas de profissional ficam guardadas, sem uso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) servicos_precos: disponibilidade + preço opcional
-- ---------------------------------------------------------------------
alter table public.servicos_precos
    add column if not exists disponivel boolean not null default true;

-- preço vazio = serviço ainda sem preço (não aparece para o cliente)
alter table public.servicos_precos
    alter column preco drop not null;


-- ---------------------------------------------------------------------
-- 2) Traz os preços da tabela por profissional para a tabela única
--
--    AVISO: se o mesmo serviço tinha preços diferentes por profissional,
--    fica o MENOR preço entre os profissionais com o serviço disponível.
--    Confira na aba Preços do painel depois de rodar.
--    Serviços que existiam só em servicos_profissionais são criados.
--    Preços que JÁ existem em servicos_precos não são sobrescritos.
-- ---------------------------------------------------------------------
do $$
begin
    if to_regclass('public.servicos_profissionais') is not null then

        insert into public.servicos_precos (nome, preco, disponivel)
        select trim(sp.servico),
               min(sp.preco) filter (where sp.disponivel and sp.preco is not null),
               bool_or(sp.disponivel)
        from public.servicos_profissionais sp
        where trim(sp.servico) <> ''
        group by trim(sp.servico)
        on conflict (nome) do nothing;

    end if;
end $$;


-- ---------------------------------------------------------------------
-- 3) Agenda única: 1 agendamento confirmado por dia + horário
--    (vale para os agendamentos novos, que não guardam profissional).
--    Os antigos, que têm profissional, continuam como estão.
-- ---------------------------------------------------------------------
do $$
begin
    create unique index if not exists agendamentos_data_horario_unico_uk
        on public.agendamentos (data, horario)
        where status = 'confirmado' and profissional is null;
exception when unique_violation then
    raise notice 'Já existem 2 agendamentos confirmados sem profissional no mesmo horário. Resolva-os (cancele um) e rode este script de novo.';
end $$;


-- ---------------------------------------------------------------------
-- 4) Consultas públicas de serviço e preço
-- ---------------------------------------------------------------------
drop function if exists public.servicos_catalogo();
create or replace function public.servicos_catalogo()
returns table (servico text, preco numeric)
language sql
stable
security definer
set search_path = public
as $$
    select p.nome::text, p.preco
    from public.servicos_precos p
    where p.disponivel = true
      and p.preco is not null
    order by p.nome;
$$;

revoke all on function public.servicos_catalogo() from public;
grant execute on function public.servicos_catalogo() to anon, authenticated;

create or replace function public.preco_servico(p_servico text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select p.preco
    from public.servicos_precos p
    where lower(trim(p.nome)) = lower(trim(p_servico))
      and p.disponivel = true
    limit 1;
$$;

revoke all on function public.preco_servico(text) from public;
grant execute on function public.preco_servico(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5) Salvar preços (painel admin)
--    Recebe: [{"nome":"Polimento","preco":350,"disponivel":true}, ...]
--    Não altera agendamentos existentes (o valor deles é histórico).
-- ---------------------------------------------------------------------
create or replace function public.salvar_precos(p_precos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    item    jsonb;
    v_nome  text;
    v_preco numeric(10,2);
    v_disp  boolean;
    total   integer := 0;
begin
    if not public.eh_admin() then
        raise exception 'Sem permissão' using errcode = '42501';
    end if;

    for item in select * from jsonb_array_elements(coalesce(p_precos, '[]'::jsonb))
    loop
        v_nome := trim(item ->> 'nome');
        v_preco := case
            when nullif(trim(item ->> 'preco'), '') is null then null
            else round((item ->> 'preco')::numeric, 2)
        end;
        v_disp := coalesce((item ->> 'disponivel')::boolean, true);

        if v_nome is null or v_nome = ''
           or (v_preco is not null and v_preco < 0) then
            continue;
        end if;

        insert into public.servicos_precos (nome, preco, disponivel, atualizado_em)
        values (v_nome, v_preco, v_disp, now())
        on conflict (nome) do update
            set preco = excluded.preco,
                disponivel = excluded.disponivel,
                atualizado_em = now();

        total := total + 1;
    end loop;

    return total;
end;
$$;

revoke all on function public.salvar_precos(jsonb) from public, anon;
grant execute on function public.salvar_precos(jsonb) to authenticated;


-- Preenche agendamentos que ficaram SEM valor (nunca sobrescreve histórico)
create or replace function public.aplicar_precos_servicos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    total integer;
begin
    if not public.eh_admin() then
        raise exception 'Sem permissão' using errcode = '42501';
    end if;

    update public.agendamentos a
       set valor = p.preco
      from public.servicos_precos p
     where lower(trim(a.procedimento)) = lower(trim(p.nome))
       and p.preco is not null
       and a.valor is null
       and a.status in ('confirmado', 'compareceu');

    get diagnostics total = row_count;
    return total;
end;
$$;

revoke all on function public.aplicar_precos_servicos() from public, anon;
grant execute on function public.aplicar_precos_servicos() to authenticated;


-- Preço de um serviço para o painel (novo agendamento criado pela dona)
drop function if exists public.preco_admin_agendamento(text, text);
create or replace function public.preco_admin_agendamento(p_servico text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select public.preco_servico(p_servico);
$$;

revoke all on function public.preco_admin_agendamento(text) from public, anon;
grant execute on function public.preco_admin_agendamento(text) to authenticated;


-- ---------------------------------------------------------------------
-- 6) Triggers de valor: o preço vem de servicos_precos, só quando o
--    agendamento ainda não tem valor. Nunca altera um valor já gravado.
-- ---------------------------------------------------------------------
create or replace function public.valor_na_criacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.valor is null then
        new.valor := public.preco_servico(new.procedimento);
    end if;
    return new;
end;
$$;

drop trigger if exists valor_na_criacao on public.agendamentos;
create trigger valor_na_criacao
    before insert on public.agendamentos
    for each row execute function public.valor_na_criacao();

create or replace function public.preencher_valor_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.valor is null and new.status in ('confirmado', 'compareceu') then
        new.valor := public.preco_servico(new.procedimento);
    end if;
    return new;
end;
$$;

drop trigger if exists preencher_valor_servico on public.agendamentos;
create trigger preencher_valor_servico
    before update on public.agendamentos
    for each row execute function public.preencher_valor_servico();


-- ---------------------------------------------------------------------
-- 7) Novo agendamento do cliente (5 parâmetros, sem profissional)
-- ---------------------------------------------------------------------
drop function if exists public.criar_agendamento(text, text, text, text, text, text);
drop function if exists public.criar_agendamento(text, text, text, text, text);

create or replace function public.criar_agendamento(
    p_nome         text,
    p_whatsapp     text,
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
    v_wa    text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
    v_preco numeric(10,2);
begin
    if auth.uid() is null then
        return 'login';
    end if;

    if length(trim(coalesce(p_nome, '')))         not between 1 and 120
       or length(trim(coalesce(p_procedimento, ''))) not between 1 and 120
       or length(v_wa) not between 10 and 13
       or p_data    !~ '^\d{4}-\d{2}-\d{2}$'
       or p_horario !~ '^\d{2}:\d{2}$' then
        return 'invalido';
    end if;

    v_preco := public.preco_servico(p_procedimento);
    if v_preco is null then
        return 'servico_indisponivel';
    end if;

    -- horário já ocupado (inclui agendamentos antigos, de qualquer profissional)
    if exists (
        select 1 from public.agendamentos o
        where o.data::text = p_data
          and left(o.horario::text, 5) = p_horario
          and o.status = 'confirmado'
    ) then
        return 'ocupado';
    end if;

    insert into public.clientes (user_id, nome, whatsapp)
    values (auth.uid(), left(trim(p_nome), 120), v_wa)
    on conflict (user_id) do nothing;

    begin
        insert into public.agendamentos
            (nome, whatsapp, procedimento, data, horario, status, valor, user_id)
        values
            (trim(p_nome), v_wa, trim(p_procedimento),
             p_data, p_horario, 'confirmado', v_preco, auth.uid());
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.criar_agendamento(text, text, text, text, text) from public, anon;
grant execute on function public.criar_agendamento(text, text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8) Remarcar (área do cliente): horário livre na agenda única.
--    Se o serviço mudar, o valor passa a ser o preço vigente do novo.
-- ---------------------------------------------------------------------
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
    v_preco      numeric(10,2);
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

    -- mesmo serviço mantém o valor congelado; serviço novo usa o preço vigente
    if lower(trim(p_procedimento)) = lower(trim(a.procedimento)) then
        v_preco := a.valor;
    else
        v_preco := public.preco_servico(p_procedimento);
        if v_preco is null then
            return 'servico_indisponivel';
        end if;
    end if;

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
    ) then
        return 'ocupado';
    end if;

    begin
        update public.agendamentos
           set data = p_data,
               horario = p_horario,
               procedimento = trim(p_procedimento),
               valor = v_preco,
               profissional = null
         where id::text = p_id;
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.cliente_remarcar(text, text, text, text) from public, anon;
grant execute on function public.cliente_remarcar(text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 9) Vincular veículo ao agendamento (sem profissional)
-- ---------------------------------------------------------------------
do $$
begin
    if to_regclass('public.veiculos') is not null then

        drop function if exists public.vincular_veiculo_agendamento(text, text, text, uuid);

        create or replace function public.vincular_veiculo_agendamento(
            p_data       text,
            p_horario    text,
            p_veiculo_id uuid
        )
        returns text
        language plpgsql
        security definer
        set search_path = public
        as $f$
        begin
            if auth.uid() is null then
                return 'login';
            end if;

            if not exists (
                select 1 from public.veiculos v
                where v.id = p_veiculo_id and v.user_id = auth.uid()
            ) then
                return 'veiculo_invalido';
            end if;

            update public.agendamentos a
               set veiculo_id = p_veiculo_id
             where a.user_id = auth.uid()
               and a.data = p_data
               and a.horario = p_horario
               and a.status = 'confirmado';

            if not found then
                return 'agendamento_nao_encontrado';
            end if;

            return 'ok';
        end;
        $f$;

        revoke all on function public.vincular_veiculo_agendamento(text, text, uuid) from public, anon;
        grant execute on function public.vincular_veiculo_agendamento(text, text, uuid) to authenticated;

    end if;
end $$;


-- ---------------------------------------------------------------------
-- CONFERÊNCIA (rode separado, se quiser)
-- ---------------------------------------------------------------------
-- Preços unificados:
--   select nome, preco, disponivel from public.servicos_precos order by nome;
-- criar_agendamento deve ter 5 parâmetros (1 linha):
--   select proname, pronargs from pg_proc
--    where proname = 'criar_agendamento';
-- Catálogo público:
--   select * from public.servicos_catalogo();
-- =====================================================================
