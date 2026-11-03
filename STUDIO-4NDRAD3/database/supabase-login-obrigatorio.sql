-- =====================================================================
-- MARGEM AUTO | Login obrigatório para agendar
--
-- COMO USAR
--   1. Rode DEPOIS de: supabase-seguranca.sql, supabase-area-cliente.sql,
--      supabase-area-cliente-correcao.sql e supabase-profissionais.sql
--      (este último cria criar_agendamento com 6 parâmetros e o índice
--      único por profissional).
--   2. SQL Editor > New query > cole tudo > Run. Pode rodar várias vezes.
--
-- O QUE FAZ
--   - Fecha a porta do agendamento SEM conta: visitante (anon) não consegue
--     mais inserir em "agendamentos", nem chamando a API direto.
--   - Cliente logado só cria agendamento pela função criar_agendamento(),
--     que grava user_id = auth.uid() (id vindo da sessão, não do navegador).
--     Não existe mais insert direto de cliente, então ninguém consegue
--     gravar user_id de outra pessoa.
--   - Cliente logado só enxerga as próprias linhas (user_id = auth.uid()).
--   - A dona continua com acesso total pela política "admin gerencia
--     agendamentos" (por e-mail), que NÃO é alterada aqui.
--
-- NÃO MUDA: horários ocupados (horarios_ocupados), status, painel admin,
-- área do cliente (cliente_agendamentos / cancelar / remarcar).
-- =====================================================================

-- 1) Visitante sem login não cria mais agendamento
drop policy if exists "site publico cria agendamento" on public.agendamentos;
revoke insert on public.agendamentos from anon;

-- 2) Cliente logado não insere direto na tabela (só via criar_agendamento)
drop policy if exists "cliente logado cria agendamento" on public.agendamentos;

-- 3) Cliente logado lê apenas os próprios agendamentos
drop policy if exists "cliente le os proprios agendamentos" on public.agendamentos;
create policy "cliente le os proprios agendamentos"
    on public.agendamentos for select to authenticated
    using (user_id = auth.uid());

-- 4) Proteção contra dois agendamentos no mesmo horário (condição de corrida).
--    Já criado por supabase-profissionais.sql; repetido aqui por segurança.
create unique index if not exists agendamentos_data_horario_prof_confirmado_uk
    on public.agendamentos (data, horario, profissional)
    where status = 'confirmado' and profissional is not null;

-- ---------------------------------------------------------------------
-- CONFERÊNCIA (rode separado, se quiser)
-- ---------------------------------------------------------------------
-- Políticas esperadas em agendamentos: "admin gerencia agendamentos" e
-- "cliente le os proprios agendamentos" (nenhuma de insert para anon/cliente):
--   select policyname, roles, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'agendamentos';
--
-- Função de agendar com 6 parâmetros (deve devolver 1 linha):
--   select proname, pronargs from pg_proc
--   where proname = 'criar_agendamento' and pronargs = 6;
--
-- Agendamentos antigos feitos sem login ficam com user_id nulo (não
-- aparecem para nenhum cliente). Para ver quantos:
--   select count(*) from public.agendamentos where user_id is null;
