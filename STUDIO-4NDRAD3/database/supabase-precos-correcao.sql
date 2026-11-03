-- =====================================================================
-- COMPATIBILIDADE | preço histórico
-- A V2 não altera agendamentos existentes quando um preço muda.
-- A configuração atual é feita por profissional em
-- database/supabase-v2-clientes-precos.sql.
-- Não mexe no e-mail da dona. Rode os scripts na ordem indicada no README.
-- =====================================================================

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
    agora     timestamp := (now() at time zone 'America/Sao_Paulo');
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
        -- V2: não altera agendamentos existentes. O valor é histórico.
    end loop;

    return total;
end;
$$;

revoke all on function public.salvar_precos(jsonb) from public, anon;
grant execute on function public.salvar_precos(jsonb) to authenticated;
