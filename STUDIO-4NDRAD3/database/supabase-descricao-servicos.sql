-- =====================================================================
-- MARGEM AUTO | Descrição dos serviços editável pelo painel
--
-- COMO USAR
--   Rode DEPOIS de supabase-sem-profissionais.sql.
--   SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
--   Não apaga dados.
--
-- O QUE FAZ
--   - servicos_precos ganha a coluna "descricao".
--   - salvar_precos passa a gravar a descrição.
--   - servicos_catalogo() (usada pelo site público) devolve a descrição.
--   Serviço sem descrição no banco continua usando o texto do
--   public/config-site.js (se o nome for igual).
-- =====================================================================

alter table public.servicos_precos
    add column if not exists descricao text
    check (descricao is null or length(descricao) <= 400);

drop function if exists public.servicos_catalogo();
create or replace function public.servicos_catalogo()
returns table (servico text, preco numeric, descricao text)
language sql
stable
security definer
set search_path = public
as $$
    select p.nome::text, p.preco, p.descricao::text
    from public.servicos_precos p
    where p.disponivel = true
      and p.preco is not null
    order by p.nome;
$$;

revoke all on function public.servicos_catalogo() from public;
grant execute on function public.servicos_catalogo() to anon, authenticated;

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
    v_desc  text;
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
        v_desc := left(nullif(trim(coalesce(item ->> 'descricao', '')), ''), 400);

        if v_nome is null or v_nome = ''
           or (v_preco is not null and v_preco < 0) then
            continue;
        end if;

        insert into public.servicos_precos (nome, preco, disponivel, descricao, atualizado_em)
        values (v_nome, v_preco, v_disp, v_desc, now())
        on conflict (nome) do update
            set preco = excluded.preco,
                disponivel = excluded.disponivel,
                descricao = excluded.descricao,
                atualizado_em = now();

        total := total + 1;
    end loop;

    return total;
end;
$$;

revoke all on function public.salvar_precos(jsonb) from public, anon;
grant execute on function public.salvar_precos(jsonb) to authenticated;
