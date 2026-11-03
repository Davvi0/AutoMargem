-- =====================================================================
-- MARGEM AUTO | Segurança do Supabase
--
-- COMO USAR
--   1. Troque  SEU_EMAIL_AQUI  (em minúsculas) pelo e-mail que a dona usa
--      para entrar em admin/login.html. Ele aparece em 4 lugares abaixo.
--   2. No Supabase: SQL Editor > New query > cole tudo > Run.
--   3. Teste: agende pelo site e depois entre no painel admin.
--
-- ATENÇÃO
--   - Se o e-mail estiver errado, o painel admin deixa de enxergar os dados.
--     É só corrigir e rodar de novo (o script pode ser executado várias vezes).
--   - O passo 1 falha se já existirem dois agendamentos "confirmado" no mesmo
--     dia e horário. Nesse caso, cancele/ajuste um deles e rode de novo.
--   - Este arquivo NÃO deve ir para a hospedagem do site.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Impede dois agendamentos confirmados no mesmo dia e horário
--    (resolve o problema de duas pessoas reservarem ao mesmo tempo)
-- ---------------------------------------------------------------------
create unique index if not exists agendamentos_data_horario_confirmado_uk
    on public.agendamentos (data, horario)
    where status = 'confirmado';


-- ---------------------------------------------------------------------
-- 2) Função pública que devolve SOMENTE os horários ocupados de um dia.
--    O site usa ela no lugar de ler a tabela inteira.
-- ---------------------------------------------------------------------
create or replace function public.horarios_ocupados(data_consulta text)
returns table (horario text)
language sql
stable
security definer
set search_path = public
as $$
    select left(a.horario::text, 5)
    from public.agendamentos a
    where a.data::text = data_consulta
      and a.status = 'confirmado';
$$;

revoke all on function public.horarios_ocupados(text) from public;
grant execute on function public.horarios_ocupados(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3) RLS: liga a proteção nas tabelas
-- ---------------------------------------------------------------------
alter table public.agendamentos enable row level security;
alter table public.despesas     enable row level security;


-- Remove as políticas antigas (nomes desconhecidos) para recomeçar do zero
do $$
declare p record;
begin
    for p in
        select policyname, tablename
        from pg_policies
        where schemaname = 'public'
          and tablename in ('agendamentos', 'despesas')
    loop
        execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    end loop;
end $$;


-- Visitante do site: só pode CRIAR agendamento (não lê, não altera, não apaga)
revoke all on public.agendamentos from anon;
grant insert on public.agendamentos to anon;
revoke all on public.despesas from anon;

create policy "site publico cria agendamento"
    on public.agendamentos
    for insert
    to anon
    with check (
        status = 'confirmado'
        and valor is null
        and length(trim(nome))         between 1 and 120
        and length(trim(whatsapp))     between 8 and 30
        and length(trim(procedimento)) between 1 and 120
    );


-- Dona (login do painel admin): acesso total, somente pelo e-mail dela
create policy "admin gerencia agendamentos"
    on public.agendamentos
    for all
    to authenticated
    using      (lower(auth.jwt() ->> 'email') = lower('SEU_EMAIL_AQUI'))
    with check (lower(auth.jwt() ->> 'email') = lower('SEU_EMAIL_AQUI'));

create policy "admin gerencia despesas"
    on public.despesas
    for all
    to authenticated
    using (
        lower(auth.jwt() ->> 'email') = lower('SEU_EMAIL_AQUI')
        and user_id = auth.uid()
    )
    with check (
        lower(auth.jwt() ->> 'email') = lower('SEU_EMAIL_AQUI')
        and user_id = auth.uid()
    );


-- ---------------------------------------------------------------------
-- 4) Recomendado (feito no painel, não por SQL):
--    Authentication > Sign In / Providers > Email
--    (ATENÇÃO) Se usar a Área do cliente, deixe "Allow new users to sign up"
--    LIGADO: clientes criam conta pelo site. Isso é seguro porque o painel
--    admin e as tabelas só aceitam o e-mail da dona (políticas acima).
--    Se NÃO usar a Área do cliente, desative esta opção.
-- ---------------------------------------------------------------------
