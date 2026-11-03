-- =====================================================================
-- MARGEM AUTO | Correção: agendamentos que não aparecem na área do cliente
-- Rode DEPOIS de supabase-area-cliente.sql. Pode rodar várias vezes.
-- =====================================================================

-- 0) DIAGNÓSTICO (rode sozinho primeiro, se quiser ver o estado atual)
--    Quantos agendamentos têm dono e quantos não têm:
--      select (user_id is not null) as vinculado, count(*) from public.agendamentos group by 1;
--    Contas de cliente SEM perfil (estas não conseguem agendar logadas
--    nem ver nada):
--      select u.id, u.email from auth.users u
--      left join public.clientes c on c.user_id = u.id
--      where c.user_id is null and u.raw_user_meta_data ->> 'tipo' = 'cliente';

-- 1) Cria o perfil das contas que se cadastraram pelo site mas ficaram
--    sem linha em "clientes" (ex.: conta criada antes do SQL da área do cliente).
insert into public.clientes (user_id, nome, whatsapp)
select u.id,
       left(trim(u.raw_user_meta_data ->> 'nome'), 120),
       regexp_replace(u.raw_user_meta_data ->> 'whatsapp', '\D', '', 'g')
from auth.users u
where u.raw_user_meta_data ->> 'tipo' = 'cliente'
  and trim(coalesce(u.raw_user_meta_data ->> 'nome', '')) <> ''
  and length(regexp_replace(coalesce(u.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g')) between 10 and 13
on conflict (user_id) do nothing;

-- 2) Vincula agendamentos antigos (feitos sem login) à conta que tem o
--    MESMO WhatsApp. Só mexe em agendamentos sem dono e em contas com
--    e-mail confirmado. Se dois perfis tiverem o mesmo WhatsApp, ignora.
update public.agendamentos a
set user_id = c.user_id
from public.clientes c
join auth.users u on u.id = c.user_id and u.email_confirmed_at is not null
where a.user_id is null
  and regexp_replace(a.whatsapp, '\D', '', 'g') = c.whatsapp
  and (select count(*) from public.clientes c2 where c2.whatsapp = c.whatsapp) = 1;


-- =====================================================================
-- 3) Gatilho de vínculo mais tolerante
--    Antes: sem perfil em "clientes" => user_id virava NULL (agendamento
--    "sumia" da área do cliente). Agora: logado mantém o próprio user_id.
-- =====================================================================
create or replace function public.agendamento_vincular_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        new.user_id := null;
    elsif exists (select 1 from public.clientes c where c.user_id = auth.uid()) then
        new.user_id := auth.uid();
    elsif new.user_id is distinct from auth.uid() then
        new.user_id := null;      -- nunca aceita dono diferente do logado
    end if;
    return new;
end;
$$;


-- =====================================================================
-- 4) Função que o site usa para agendar LOGADO.
--    Grava user_id = auth.uid() e cria o perfil se faltar.
--    Retorna: ok | ocupado | invalido | login
-- =====================================================================
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
    v_wa text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
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

    insert into public.clientes (user_id, nome, whatsapp)
    values (auth.uid(), left(trim(p_nome), 120), v_wa)
    on conflict (user_id) do nothing;

    begin
        -- format %L: funciona se data/horario forem text OU date/time
        execute format(
            'insert into public.agendamentos (nome, whatsapp, procedimento, data, horario, status, user_id) values (%L, %L, %L, %L, %L, %L, %L)',
            trim(p_nome), v_wa, trim(p_procedimento), p_data, p_horario, 'confirmado', auth.uid()
        );
    exception when unique_violation then
        return 'ocupado';
    end;

    return 'ok';
end;
$$;

revoke all on function public.criar_agendamento(text, text, text, text, text) from public, anon;
grant execute on function public.criar_agendamento(text, text, text, text, text) to authenticated;


-- =====================================================================
-- 5) Conta da DONA não deve ser cliente. Troque o e-mail e rode:
--    (remove o perfil de cliente criado quando ela agendou logada)
-- =====================================================================
-- delete from public.clientes
-- where user_id in (select id from auth.users where lower(email) = lower('EMAIL_DA_DONA'));
