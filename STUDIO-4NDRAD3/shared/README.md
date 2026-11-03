# Sistema Base

Este projeto foi reorganizado a partir do projeto EMMEKÁ enviado.

## Para criar outro cliente
1. Duplique a pasta.
2. Altere `shared/config.js`.
3. Troque textos, logo, imagens e CSS em `public/`.
4. Configure o novo projeto/banco Supabase.
5. Ajuste as credenciais Supabase no `public/agendamento.js` e `admin/core.js`.

## Módulos
- `admin/login/` — autenticação
- `admin/agenda/` — organização da agenda
- `admin/dashboard/` — dashboard
- `admin/reativacao/` — reativação de clientes
- `admin/financeiro/` — financeiro
- `public/` — agendamento do cliente
- `database/` — SQL de segurança

## Observação
Os arquivos `admin/core.js` e `public/agendamento.js` preservam o código funcional original do projeto enviado. Os arquivos `*-core.js` dentro dos módulos são cópias organizacionais do núcleo atual; eles não devem ser carregados simultaneamente no HTML, para evitar funções/eventos duplicados.
