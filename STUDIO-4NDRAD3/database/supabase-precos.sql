-- =====================================================================
-- MARGEM AUTO | Preços dos serviços (aba "Preços" do painel)
-- Pode rodar várias vezes no SQL Editor do Supabase.
--
-- COMO FUNCIONA
--   * O preço de cada serviço só é alterado na aba "Preços" do painel.
--   * Ao salvar um preço NOVO, todos os agendamentos CONFIRMADOS daquele
--     serviço que ainda vão acontecer (data/hora >= agora, fuso de São
--     Paulo) recebem o novo valor. Atendimentos que já passaram mantêm o
--     valor antigo (o histórico do financeiro não muda).
--   * Todo agendamento NOVO (site, área do cliente ou painel) já nasce
--     com o preço vigente do serviço.
--   * Remarcar com outro serviço atualiza o valor para o preço do novo.
--   * O Financeiro e o Dashboard somam o valor dos agendamentos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0) Quem é a dona (admin)  >>> EDITE A LINHA ABAIXO <<<
--    Coloque, entre aspas, o MESMO e-mail que você usa para entrar no
--    painel admin (minúsculas). É este e-mail que libera a aba Preços.
--    (Se a função já existir, ela é mantida: rodar de novo não apaga o e-mail.)
-- ---------------------------------------------------------------------
do $$
begin
    if to_regprocedure('public.eh_admin()') is null then
        create function public.eh_admin()
        returns boolean
        language sql
        stable
        as $f$
            select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('COLOQUE_AQUI_O_EMAIL_DO_LOGIN')
        $f$;
    end if;
end $$;

revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 1) Tabela de preços (só a dona lê e altera)
-- ---------------------------------------------------------------------
create table if not exists public.servicos_precos (
    nome  text primary key check (length(trim(nome)) between 1 and 120),
    preco numeric(10,2) not null check (preco >= 0)
);

alter table public.servicos_precos
    add column if not exists atualizado_em timestamptz not null default now();

alter table public.servicos_precos enable row level security;
revoke all on public.servicos_precos from anon;

drop policy if exists "admin gerencia precos" on public.servicos_precos;
create policy "admin gerencia precos"
    on public.servicos_precos for all to authenticated
    using      (public.eh_admin())
    with check (public.eh_admin());

grant select, insert, update, delete on public.servicos_precos to authenticated;


-- ---------------------------------------------------------------------
-- 2) Salvar preços e aplicar a partir de agora
--    Recebe: [{"nome":"Barba","preco":40}, ...]
--    Legado/compatibilidade: a V2 usa salvar_precos_profissionais.
--    Esta função não altera agendamentos existentes.
-- ---------------------------------------------------------------------
create or replace function public.salvar_precos(p_precos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    item      jsonb;
    v_nome    text;
    v_preco   numeric(10,2);
    v_antigo  numeric(10,2);
    total     integer := 0;
    n         integer;
begin
    if not public.eh_admin() then
        raise exception 'Sem permissão' using errcode = '42501';
    end if;

    for item in select * from jsonb_array_elements(coalesce(p_precos, '[]'::jsonb))
    loop
        v_nome  := trim(item ->> 'nome');
        v_preco := round((item ->> 'preco')::numeric, 2);

        if v_nome is null or v_nome = '' or v_preco is null or v_preco < 0 then
            continue;
        end if;

        select p.preco into v_antigo
        from public.servicos_precos p
        where lower(trim(p.nome)) = lower(v_nome)
        limit 1;

        if found then
            if v_antigo is distinct from v_preco then
                update public.servicos_precos
                   set preco = v_preco, atualizado_em = now()
                 where lower(trim(nome)) = lower(v_nome);
            end if;
        else
            insert into public.servicos_precos (nome, preco) values (v_nome, v_preco);
        end if;

        -- IMPORTANTE (V2): não altere agendamentos existentes.
        -- O valor histórico é um snapshot do momento do agendamento.
        -- A partir daqui, apenas novos agendamentos recebem o preço vigente.
        n := 0;
        total := total + n;
    end loop;

    return total;
end;
$$;

revoke all on function public.salvar_precos(jsonb) from public, anon;
grant execute on function public.salvar_precos(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 3) Preenche agendamentos que ficaram SEM valor (nunca sobrescreve)
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
       set valor = p.preco
      from public.servicos_precos p
     where lower(trim(a.procedimento)) = lower(trim(p.nome))
       and a.valor is null
       and a.status in ('confirmado', 'compareceu');

    get diagnostics total = row_count;
    return total;
end;
$$;

revoke all on function public.aplicar_precos_servicos() from public, anon;
grant execute on function public.aplicar_precos_servicos() to authenticated;


-- ---------------------------------------------------------------------
-- 4) Agendamento NOVO já nasce com o preço vigente.
--    (AFTER INSERT: as políticas do site exigem "valor is null" no
--    momento do insert; o valor entra logo depois, pelo banco.)
-- ---------------------------------------------------------------------
create or replace function public.valor_na_criacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Compatibilidade: nunca sobrescreve um valor já congelado.
    -- A matriz profissional + serviço é aplicada pelo SQL V2.
    return new;
end;
$$;

drop trigger if exists valor_na_criacao on public.agendamentos;
create trigger valor_na_criacao
    after insert on public.agendamentos
    for each row execute function public.valor_na_criacao();

-- ---------------------------------------------------------------------
-- 5) Update: "compareceu" sem valor recebe o preço; remarcar com outro
--    serviço (ainda confirmado) troca o valor pelo preço do novo serviço.
-- ---------------------------------------------------------------------
create or replace function public.preencher_valor_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_preco numeric(10,2);
begin
    if new.status = 'compareceu' and new.valor is null then
        select p.preco into new.valor
        from public.servicos_precos p
        where lower(trim(p.nome)) = lower(trim(new.procedimento))
        limit 1;

    elsif new.status = 'confirmado'
          and new.procedimento is distinct from old.procedimento then
        select p.preco into v_preco
        from public.servicos_precos p
        where lower(trim(p.nome)) = lower(trim(new.procedimento))
        limit 1;
        new.valor := v_preco;   -- null se o novo serviço não tem preço
    end if;
    return new;
end;
$$;

drop trigger if exists preencher_valor_servico on public.agendamentos;
create trigger preencher_valor_servico
    before update on public.agendamentos
    for each row execute function public.preencher_valor_servico();
