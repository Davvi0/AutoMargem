-- =====================================================================
-- MARGEM AUTO | V2 — preço por profissional + serviços por profissional
-- Rode DEPOIS dos scripts atuais de segurança, área do cliente,
-- profissionais e preços.
--
-- Este script é incremental:
--   * não apaga dados;
--   * preserva servicos_precos como referência/compatibilidade;
--   * cria o preço por profissional;
--   * congela o valor no agendamento;
--   * não altera o valor de agendamentos antigos quando o preço muda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Relação profissional + serviço + preço + disponibilidade
-- ---------------------------------------------------------------------
create table if not exists public.servicos_profissionais (
    profissional text not null check (length(trim(profissional)) between 1 and 60),
    servico      text not null check (length(trim(servico)) between 1 and 120),
    preco        numeric(10,2) check (preco is null or preco >= 0),
    disponivel   boolean not null default true,
    atualizado_em timestamptz not null default now(),
    primary key (profissional, servico)
);

alter table public.servicos_profissionais enable row level security;

revoke all on public.servicos_profissionais from anon;

drop policy if exists "admin gerencia servicos profissionais" on public.servicos_profissionais;
create policy "admin gerencia servicos profissionais"
    on public.servicos_profissionais for all to authenticated
    using (public.eh_admin())
    with check (public.eh_admin());

grant select, insert, update, delete on public.servicos_profissionais to authenticated;

-- ---------------------------------------------------------------------
-- 2) Inicialização segura
--    Todo serviço já existente é habilitado para os 4 profissionais e
--    recebe o preço global atual, sem alterar nenhum agendamento.
-- ---------------------------------------------------------------------
insert into public.servicos_profissionais (profissional, servico, preco, disponivel)
select p.profissional, s.nome, s.preco, true
from (
    select distinct trim(profissional) as profissional
    from public.agendamentos
    where profissional is not null and trim(profissional) <> ''
    union
    select unnest(array[
        'Profissional 1','Profissional 2','Profissional 3','Profissional 4'
    ]) as profissional
) p
cross join public.servicos_precos s
where trim(s.nome) <> ''
on conflict (profissional, servico) do nothing;

-- ---------------------------------------------------------------------
-- 3) Índices
-- ---------------------------------------------------------------------
create index if not exists servicos_profissionais_servico_idx
    on public.servicos_profissionais (servico);

-- ---------------------------------------------------------------------
-- 4) Consulta pública segura: preço exato da combinação
-- ---------------------------------------------------------------------
create or replace function public.preco_servico_profissional(
    p_profissional text,
    p_servico text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select sp.preco
            from public.servicos_profissionais sp
            where lower(trim(sp.profissional)) = lower(trim(p_profissional))
              and lower(trim(sp.servico)) = lower(trim(p_servico))
              and sp.disponivel = true
            limit 1
        ),
        (
            select p.preco
            from public.servicos_precos p
            where lower(trim(p.nome)) = lower(trim(p_servico))
            and not exists (
                select 1
                from public.servicos_profissionais sp2
                where lower(trim(sp2.profissional)) = lower(trim(p_profissional))
                  and lower(trim(sp2.servico)) = lower(trim(p_servico))
            )
            limit 1
        )
    );
$$;

revoke all on function public.preco_servico_profissional(text, text) from public;
grant execute on function public.preco_servico_profissional(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) Consulta pública segura: serviços disponíveis de um profissional
-- ---------------------------------------------------------------------
drop function if exists public.servicos_profissional(text);
create or replace function public.servicos_profissional(p_profissional text)
returns table (
    servico text,
    preco numeric
)
language sql
stable
security definer
set search_path = public
as $$
    select x.servico, x.preco
    from (
        select sp.servico, sp.preco
        from public.servicos_profissionais sp
        where lower(trim(sp.profissional)) = lower(trim(p_profissional))
          and sp.disponivel = true

        union all

        select p.nome, p.preco
        from public.servicos_precos p
        where not exists (
            select 1
            from public.servicos_profissionais sp2
            where lower(trim(sp2.profissional)) = lower(trim(p_profissional))
              and lower(trim(sp2.servico)) = lower(trim(p.nome))
        )
    ) x
    order by x.servico;
$$;

revoke all on function public.servicos_profissional(text) from public;
grant execute on function public.servicos_profissional(text) to anon, authenticated;

-- Lista pública dos serviços que existem na matriz de profissionais.
create or replace function public.servicos_disponiveis()
returns table (servico text)
language sql
stable
security definer
set search_path = public
as $$
    select distinct x.servico
    from (
        select sp.servico
        from public.servicos_profissionais sp
        where sp.disponivel = true
        union all
        select p.nome
        from public.servicos_precos p
        where not exists (
            select 1 from public.servicos_profissionais sp2
            where lower(trim(sp2.servico)) = lower(trim(p.nome))
        )
    ) x
    order by x.servico;
$$;

revoke all on function public.servicos_disponiveis() from public;
grant execute on function public.servicos_disponiveis() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Salvar toda a matriz enviada pelo ADMIN
--    Formato:
--    [{"profissional":"João","servico":"Corte","preco":50,"disponivel":true}]
--
--    IMPORTANTE: não toca em agendamentos existentes.
-- ---------------------------------------------------------------------
create or replace function public.salvar_precos_profissionais(p_precos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    item jsonb;
    v_prof text;
    v_serv text;
    v_preco numeric(10,2);
    v_disp boolean;
    total integer := 0;
begin
    if not public.eh_admin() then
        raise exception 'Sem permissão' using errcode = '42501';
    end if;

    for item in select * from jsonb_array_elements(coalesce(p_precos, '[]'::jsonb))
    loop
        v_prof := trim(item ->> 'profissional');
        v_serv := trim(item ->> 'servico');
        v_preco := case
            when nullif(trim(item ->> 'preco'), '') is null then null
            else round((item ->> 'preco')::numeric, 2)
        end;
        v_disp := coalesce((item ->> 'disponivel')::boolean, true);

        if v_prof is null or v_prof = ''
           or v_serv is null or v_serv = ''
           or v_preco is not null and v_preco < 0 then
            continue;
        end if;

        insert into public.servicos_profissionais
            (profissional, servico, preco, disponivel, atualizado_em)
        values
            (v_prof, v_serv, v_preco, v_disp, now())
        on conflict (profissional, servico)
        do update set
            preco = excluded.preco,
            disponivel = excluded.disponivel,
            atualizado_em = now();

        total := total + 1;
    end loop;

    return total;
end;
$$;

revoke all on function public.salvar_precos_profissionais(jsonb) from public, anon;
grant execute on function public.salvar_precos_profissionais(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 7) Preencher apenas agendamentos sem valor, usando a combinação correta.
--    Nunca sobrescreve histórico que já possui valor.
-- ---------------------------------------------------------------------
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
       set valor = sp.preco
      from public.servicos_profissionais sp
     where lower(trim(a.profissional)) = lower(trim(sp.profissional))
       and lower(trim(a.procedimento)) = lower(trim(sp.servico))
       and sp.disponivel = true
       and a.valor is null
       and a.status in ('confirmado', 'compareceu')
       and sp.preco is not null;

    get diagnostics total = row_count;
    return total;
end;
$$;

revoke all on function public.aplicar_precos_servicos() from public, anon;
grant execute on function public.aplicar_precos_servicos() to authenticated;

-- ---------------------------------------------------------------------
-- 8) Novo agendamento: preço vem da combinação profissional + serviço.
--    O valor fica gravado no próprio agendamento.
-- ---------------------------------------------------------------------
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
    v_preco numeric(10,2);
begin
    if auth.uid() is null then
        return 'login';
    end if;

    if length(trim(coalesce(p_nome, ''))) not between 1 and 120
       or length(trim(coalesce(p_procedimento, ''))) not between 1 and 120
       or length(trim(coalesce(p_profissional, ''))) not between 1 and 60
       or length(v_wa) not between 10 and 13
       or p_data !~ '^\d{4}-\d{2}-\d{2}$'
       or p_horario !~ '^\d{2}:\d{2}$' then
        return 'invalido';
    end if;

    select sp.preco into v_preco
    from public.servicos_profissionais sp
    where lower(trim(sp.profissional)) = lower(trim(p_profissional))
      and lower(trim(sp.servico)) = lower(trim(p_procedimento))
    limit 1;

    if found then
        if not exists (
            select 1
            from public.servicos_profissionais sp2
            where lower(trim(sp2.profissional)) = lower(trim(p_profissional))
              and lower(trim(sp2.servico)) = lower(trim(p_procedimento))
              and sp2.disponivel = true
        ) or v_preco is null then
            return 'servico_indisponivel';
        end if;
    else
        select p.preco into v_preco
        from public.servicos_precos p
        where lower(trim(p.nome)) = lower(trim(p_procedimento))
        limit 1;

        if not found or v_preco is null then
            return 'servico_indisponivel';
        end if;
    end if;

    insert into public.clientes (user_id, nome, whatsapp)
    values (auth.uid(), left(trim(p_nome), 120), v_wa)
    on conflict (user_id) do nothing;

    begin
        insert into public.agendamentos
            (nome, whatsapp, procedimento, profissional, data, horario, status, valor, user_id)
        values
            (trim(p_nome), v_wa, trim(p_procedimento), trim(p_profissional),
             p_data, p_horario, 'confirmado', v_preco, auth.uid());
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.criar_agendamento(text, text, text, text, text, text) from public, anon;
grant execute on function public.criar_agendamento(text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9) Trigger de compatibilidade:
--    se alguma inserção antiga ainda chegar sem valor, tenta usar o preço
--    da combinação. Nunca sobrescreve um valor já gravado.
-- ---------------------------------------------------------------------
create or replace function public.valor_na_criacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_preco numeric(10,2);
begin
    if new.valor is null and new.profissional is not null then
        v_preco := public.preco_servico_profissional(new.profissional, new.procedimento);

        if v_preco is not null then
            update public.agendamentos
               set valor = v_preco
             where id = new.id;
        end if;
    end if;

    return null;
end;
$$;

drop trigger if exists valor_na_criacao on public.agendamentos;
create trigger valor_na_criacao
    after insert on public.agendamentos
    for each row execute function public.valor_na_criacao();

-- ---------------------------------------------------------------------
-- 10) Trigger de atualização: se um registro legado sem valor chegar a
--     "compareceu", usa o preço do profissional + serviço. Nunca altera
--     um valor histórico que já exista.
-- ---------------------------------------------------------------------
create or replace function public.preencher_valor_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.valor is null and new.profissional is not null then
        select public.preco_servico_profissional(new.profissional, new.procedimento)
          into new.valor;
    end if;

    return new;
end;
$$;

drop trigger if exists preencher_valor_servico on public.agendamentos;
create trigger preencher_valor_servico
    before update on public.agendamentos
    for each row execute function public.preencher_valor_servico();

-- ---------------------------------------------------------------------
-- 11) Remarcação da área do cliente:
--    se o serviço mudar, o valor passa a ser o preço vigente daquele
--    profissional + serviço. Se não houver combinação, recusa.
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
    a public.agendamentos%rowtype;
    quando_atual timestamp;
    quando_novo timestamp;
    agora timestamp := (now() at time zone 'America/Sao_Paulo');
    antecedencia interval := interval '2 hours';
    v_preco numeric(10,2);
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

    select sp.preco into v_preco
    from public.servicos_profissionais sp
    where lower(trim(sp.profissional)) = lower(trim(a.profissional))
      and lower(trim(sp.servico)) = lower(trim(p_procedimento))
    limit 1;

    if found then
        if not exists (
            select 1
            from public.servicos_profissionais sp2
            where lower(trim(sp2.profissional)) = lower(trim(a.profissional))
              and lower(trim(sp2.servico)) = lower(trim(p_procedimento))
              and sp2.disponivel = true
        ) or v_preco is null then
            return 'servico_indisponivel';
        end if;
    else
        select p.preco into v_preco
        from public.servicos_precos p
        where lower(trim(p.nome)) = lower(trim(p_procedimento))
        limit 1;
        if not found or v_preco is null then
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
          and (o.profissional is null or a.profissional is null or o.profissional = a.profissional)
    ) then
        return 'ocupado';
    end if;

    begin
        execute format(
            'update public.agendamentos set data = %L, horario = %L, procedimento = %L, valor = %L where id::text = %L',
            p_data, p_horario, trim(p_procedimento), v_preco, p_id
        );
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.cliente_remarcar(text, text, text, text) from public, anon;
grant execute on function public.cliente_remarcar(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11) Política do visitante: continua funcionando, mas exige profissional
--     e deixa o banco preencher o valor.
-- ---------------------------------------------------------------------
drop policy if exists "site publico cria agendamento" on public.agendamentos;
create policy "site publico cria agendamento"
    on public.agendamentos for insert to anon
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome)) between 1 and 120
        and length(trim(whatsapp)) between 8 and 30
        and length(trim(procedimento)) between 1 and 120
        and length(trim(coalesce(profissional, ''))) between 1 and 60
    );

drop policy if exists "cliente logado cria agendamento" on public.agendamentos;
create policy "cliente logado cria agendamento"
    on public.agendamentos for insert to authenticated
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome)) between 1 and 120
        and length(trim(whatsapp)) between 8 and 30
        and length(trim(procedimento)) between 1 and 120
        and length(trim(coalesce(profissional, ''))) between 1 and 60
        and exists (select 1 from public.clientes c where c.user_id = auth.uid())
    );

-- ---------------------------------------------------------------------
-- 12) Função admin para criar agendamento com preço exato
--     (o frontend do painel continua podendo usar insert; esta função
--      fica disponível para futuras evoluções sem expor a tabela).
-- ---------------------------------------------------------------------
create or replace function public.preco_admin_agendamento(
    p_profissional text,
    p_servico text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select public.preco_servico_profissional(p_profissional, p_servico);
$$;

revoke all on function public.preco_admin_agendamento(text, text) from public, anon;
grant execute on function public.preco_admin_agendamento(text, text) to authenticated;
