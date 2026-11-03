-- =====================================================================
-- MARGEM AUTO | Migração incremental: veículos + pagamentos
--
-- COMO USAR
--   1. Rode ANTES os scripts anteriores (seguranca, area-cliente, profissionais,
--      precos e v2-clientes-precos). Este script usa public.eh_admin(), criada
--      em supabase-precos.sql.
--   2. Supabase > SQL Editor > New query > cole tudo > Run.
--   3. Pode ser executado mais de uma vez (é idempotente). Não apaga dados.
--
-- O QUE FAZ
--   a) agendamentos: colunas pago, data_pagamento, forma_pagamento, veiculo_id.
--      -> separa "receita agendada" de "pagamento recebido".
--   b) veiculos: tabela nova (um cliente pode ter vários veículos).
--   c) RLS: cliente só enxerga/edita os próprios veículos; admin enxerga todos.
--   d) vincular_veiculo_agendamento(): o cliente associa um veículo dele ao
--      agendamento que acabou de criar (sem alterar criar_agendamento).
--
-- NÃO MUDA: criar_agendamento, cancelar/remarcar, horarios_ocupados, preços,
-- políticas existentes de agendamentos e despesas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Veículos
-- ---------------------------------------------------------------------
create table if not exists public.veiculos (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid references auth.users(id) on delete cascade,  -- dono com conta (nulo se cadastrado pelo admin)
    whatsapp   text,                                              -- só dígitos; liga o veículo ao cliente quando não há conta
    marca      text not null check (length(trim(marca))  between 1 and 40),
    modelo     text not null check (length(trim(modelo)) between 1 and 60),
    ano        integer check (ano is null or ano between 1950 and 2100),
    cor        text check (cor is null or length(trim(cor)) between 1 and 30),
    placa      text check (placa is null or placa ~ '^[A-Z0-9]{7}$'),   -- ABC1D23 ou ABC1234 (sem hífen)
    criado_em  timestamptz not null default now(),
    constraint veiculos_dono_ck check (user_id is not null or whatsapp is not null)
);

create index if not exists veiculos_user_idx     on public.veiculos (user_id);
create index if not exists veiculos_whatsapp_idx on public.veiculos (whatsapp);

-- uma mesma placa não se repete para o mesmo dono
create unique index if not exists veiculos_user_placa_uk
    on public.veiculos (user_id, placa) where user_id is not null and placa is not null;
create unique index if not exists veiculos_wa_placa_uk
    on public.veiculos (whatsapp, placa) where user_id is null and placa is not null;

-- normaliza placa (maiúscula, sem hífen/espaço) e whatsapp (só dígitos)
create or replace function public.veiculos_normalizar()
returns trigger
language plpgsql
as $$
begin
    new.placa    := nullif(upper(regexp_replace(coalesce(new.placa, ''), '[^A-Za-z0-9]', '', 'g')), '');
    new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), '');
    new.marca    := trim(new.marca);
    new.modelo   := trim(new.modelo);
    return new;
end;
$$;

drop trigger if exists veiculos_normalizar on public.veiculos;
create trigger veiculos_normalizar
    before insert or update on public.veiculos
    for each row execute function public.veiculos_normalizar();

alter table public.veiculos enable row level security;

drop policy if exists "cliente le os proprios veiculos"      on public.veiculos;
drop policy if exists "cliente cria os proprios veiculos"    on public.veiculos;
drop policy if exists "cliente atualiza os proprios veiculos" on public.veiculos;
drop policy if exists "cliente remove os proprios veiculos"  on public.veiculos;
drop policy if exists "admin gerencia veiculos"              on public.veiculos;

create policy "cliente le os proprios veiculos"
    on public.veiculos for select to authenticated
    using (user_id = auth.uid());

create policy "cliente cria os proprios veiculos"
    on public.veiculos for insert to authenticated
    with check (user_id = auth.uid());

create policy "cliente atualiza os proprios veiculos"
    on public.veiculos for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "cliente remove os proprios veiculos"
    on public.veiculos for delete to authenticated
    using (user_id = auth.uid());

create policy "admin gerencia veiculos"
    on public.veiculos for all to authenticated
    using (public.eh_admin())
    with check (public.eh_admin());

revoke all on public.veiculos from anon;
grant select, insert, update, delete on public.veiculos to authenticated;


-- ---------------------------------------------------------------------
-- 2) Agendamentos: pagamento recebido + veículo
-- ---------------------------------------------------------------------
alter table public.agendamentos
    add column if not exists pago            boolean not null default false,
    add column if not exists data_pagamento  timestamptz,
    add column if not exists forma_pagamento text,
    add column if not exists veiculo_id      uuid references public.veiculos(id) on delete set null;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'agendamentos_forma_pagamento_ck') then
        alter table public.agendamentos
            add constraint agendamentos_forma_pagamento_ck
            check (forma_pagamento is null or forma_pagamento in
                   ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro'));
    end if;
end $$;

create index if not exists agendamentos_veiculo_idx on public.agendamentos (veiculo_id);
create index if not exists agendamentos_pago_data_idx on public.agendamentos (pago, data);

-- coerência: ao marcar como pago grava a data/hora; ao desmarcar limpa os campos
create or replace function public.agendamento_pagamento_coerente()
returns trigger
language plpgsql
as $$
begin
    if new.pago then
        if new.data_pagamento is null then
            new.data_pagamento := now();
        end if;
    else
        new.data_pagamento  := null;
        new.forma_pagamento := null;
    end if;
    return new;
end;
$$;

drop trigger if exists agendamento_pagamento_coerente on public.agendamentos;
create trigger agendamento_pagamento_coerente
    before insert or update of pago, data_pagamento, forma_pagamento on public.agendamentos
    for each row execute function public.agendamento_pagamento_coerente();

-- Obs.: cliente comum NÃO consegue alterar pagamento: não há política de
-- update/insert para ele em agendamentos (só a política do admin e as funções
-- security definer existentes). O admin continua com acesso total.


-- ---------------------------------------------------------------------
-- 3) Cliente associa um veículo dele ao agendamento que acabou de criar
-- ---------------------------------------------------------------------
create or replace function public.vincular_veiculo_agendamento(
    p_data         text,
    p_horario      text,
    p_profissional text,
    p_veiculo_id   uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ag uuid;
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
       and a.profissional = p_profissional
       and a.status = 'confirmado';

    if not found then
        return 'agendamento_nao_encontrado';
    end if;

    return 'ok';
end;
$$;

revoke all on function public.vincular_veiculo_agendamento(text, text, text, uuid) from public, anon;
grant execute on function public.vincular_veiculo_agendamento(text, text, text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- OPCIONAL: agendamentos antigos
-- Os atendimentos anteriores a esta migração entram como "não pagos".
-- Se você sabe que tudo que já foi realizado foi pago, rode (uma vez):
--
--   update public.agendamentos
--      set pago = true, forma_pagamento = 'outro'
--    where status = 'compareceu' and valor is not null and pago = false;
--
-- CONFERÊNCIA
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'veiculos';
-- =====================================================================
