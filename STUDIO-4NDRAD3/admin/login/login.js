const SUPABASE_URL = "https://kliiyznbugxfolcauopi.supabase.co";
const SUPABASE_KEY = "sb_publishable_eSYeWOHTNVlotqwwdyt8BQ_i7ddVOEp";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


const formulario = document.getElementById("formLogin");
const mensagem = document.getElementById("mensagem");


formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    mensagem.textContent = "Entrando...";


    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });


    if (error) {

        console.error(error);

        mensagem.textContent = "E-mail ou senha incorretos.";

        return;
    }


    if (adminConfigurado() && !souAdmin(email)) {

        await supabaseClient.auth.signOut();

        mensagem.textContent =
            "Esta conta não tem acesso ao painel. Clientes entram em Meus horários.";

        return;
    }


    window.location.href = "../painel.html";

});