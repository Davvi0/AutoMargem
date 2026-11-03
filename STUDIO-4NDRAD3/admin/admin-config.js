// E-mail da dona (o MESMO usado no supabase-seguranca.sql), em minúsculas.
// Só essa conta entra no painel. Contas de cliente são barradas.
const ADMIN_EMAIL = "dono@salao.com";
const souAdmin = email =>
    String(email || "").trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
const adminConfigurado = () => ADMIN_EMAIL.includes("@");

// Serviços que aparecem na aba Preços. Igual aos nomes de "servicos" em public/config-site.js.
// (Na aba também dá para adicionar outros serviços.)
const SERVICOS = ["Lavagem Premium", "Higienização Interna", "Polimento", "Proteção e Coating Cerâmico", "Hidratação de Couro", "Detalhamento Completo"];
