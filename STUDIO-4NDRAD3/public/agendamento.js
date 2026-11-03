// ============================================
// SUPABASE
// ============================================

const SUPABASE_URL =
    "https://kliiyznbugxfolcauopi.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_eSYeWOHTNVlotqwwdyt8BQ_i7ddVOEp";


const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
});
const formatarMoeda = valor => formatadorMoeda.format(Number(valor) || 0);


// ============================================
// WHATSAPP DA MARGEM AUTO
// ============================================

// Coloque o número da empresa aqui.
// Formato:
// 55 + DDD + número
//
// Exemplo:
// 5515999999999

const WHATSAPP_EMPRESA =
    "5511994583475";


// ============================================
// ELEMENTOS
// ============================================

const formulario =
    document.getElementById(
        "formAgendamento"
    );


const campoNome =
    document.getElementById(
        "nome"
    );


const campoWhatsapp =
    document.getElementById(
        "whatsapp"
    );

// ============================================
// MÁSCARA DO WHATSAPP
// ============================================

campoWhatsapp.addEventListener(
    "input",
    () => {

        let valor =
            campoWhatsapp.value.replace(/\D/g, "");

        // Limita a 11 dígitos
        valor =
            valor.substring(0, 11);

        if (valor.length <= 2) {

            campoWhatsapp.value =
                `(${valor}`;

        } else if (valor.length <= 7) {

            campoWhatsapp.value =
                `(${valor.substring(0, 2)}) ${valor.substring(2)}`;

        } else {

            campoWhatsapp.value =
                `(${valor.substring(0, 2)}) ${valor.substring(2, 7)}-${valor.substring(7)}`;

        }

    }
);



const campoProcedimento =
    document.getElementById(
        "procedimento"
    );


const campoData =
    document.getElementById(
        "data"
    );


const campoHorario =
    document.getElementById(
        "horario"
    );


const btnAgendar =
    document.getElementById(
        "btnAgendar"
    );


const mensagem =
    document.getElementById(
        "mensagem"
    );


const confirmacao =
    document.getElementById(
        "confirmacao"
    );


const confirmacaoNome =
    document.getElementById(
        "confirmacaoNome"
    );


const confirmacaoProcedimento =
    document.getElementById(
        "confirmacaoProcedimento"
    );


const confirmacaoData =
    document.getElementById(
        "confirmacaoData"
    );


const confirmacaoHorario =
    document.getElementById(
        "confirmacaoHorario"
    );


const btnWhatsApp =
    document.getElementById(
        "btnWhatsApp"
    );


const novoAgendamento =
    document.getElementById(
        "novoAgendamento"
    );


// ============================================
// HORÁRIOS
// ============================================

const horariosDisponiveis = [

    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00"

];


// ============================================
// DATA MÍNIMA
// ============================================

const hoje =
    new Date();

const ano =
    hoje.getFullYear();

const mes =
    String(
        hoje.getMonth() + 1
    ).padStart(2, "0");

const dia =
    String(
        hoje.getDate()
    ).padStart(2, "0");


campoData.min =
    `${ano}-${mes}-${dia}`;


// ============================================
// BUSCAR HORÁRIOS OCUPADOS
// Usa a função segura do banco (horarios_ocupados), que devolve
// só os horários, sem expor dados das clientes. Se a função ainda
// não existir (SQL de segurança não aplicado), usa a consulta antiga.
// ============================================

async function buscarHorariosOcupados(
    dataEscolhida
) {

    const {
        data: linhas,
        error: erroRpc
    } = await supabaseClient.rpc(
        "horarios_ocupados",
        {
            data_consulta: dataEscolhida
        }
    );

    if (!erroRpc && Array.isArray(linhas)) {

        return {
            horarios: linhas
                .map(
                    linha =>
                        (linha.horario || "")
                            .substring(0, 5)
                )
                .filter(Boolean),
            error: null
        };

    }

    const {
        data: agendamentos,
        error
    } = await supabaseClient

        .from("agendamentos")

        .select("horario")

        .eq("data", dataEscolhida)

        .eq("status", "confirmado");

    if (error) {

        return {
            horarios: [],
            error: error
        };

    }

    return {
        horarios: agendamentos
            .map(
                agendamento =>
                    (agendamento.horario || "")
                        .substring(0, 5)
            )
            .filter(Boolean),
        error: null
    };

}


// ============================================
// PREÇO DO SERVIÇO (tabela única, definida no painel > Preços)
// ============================================

async function obterPrecoServico(procedimento) {
    if (!procedimento) return null;

    const { data, error } = await supabaseClient.rpc(
        "preco_servico",
        { p_servico: procedimento }
    );

    if (error) {
        console.error("Erro ao buscar preço do serviço:", error);
        return null;
    }

    return data === null || data === undefined ? null : Number(data);
}

window.obterPrecoServico = obterPrecoServico;


// ============================================
// CARREGAR HORÁRIOS
// ============================================

async function carregarHorarios() {

    const dataEscolhida =
        campoData.value;


    if (!dataEscolhida) {

        campoHorario.innerHTML = `

            <option value="">
                Selecione uma data primeiro
            </option>

        `;

        return;
    }


    campoHorario.innerHTML = `

        <option value="">
            Carregando horários...
        </option>

    `;


    const {
        horarios: horariosOcupados,
        error
    } = await buscarHorariosOcupados(
        dataEscolhida
    );


    if (error) {

        console.error(
            "Erro ao buscar horários:",
            error
        );


        campoHorario.innerHTML = `

            <option value="">
                Erro ao carregar
            </option>

        `;

        return;
    }




    campoHorario.innerHTML = `

        <option value="">
            Selecione um horário
        </option>

    `;


    horariosDisponiveis.forEach(
        horario => {

            const ocupado =
                horariosOcupados.includes(
                    horario
                );


            const agora = new Date();

            const dataHoje =
                `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;

            const horaAgora =
                `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;

            const jaPassou =
                dataEscolhida === dataHoje &&
                horario <= horaAgora;


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                horario;


            if (ocupado) {

                option.textContent =
                    `${horario} - Ocupado`;

                option.disabled =
                    true;

            } else if (jaPassou) {

                option.textContent =
                    `${horario} - Indisponível`;

                option.disabled =
                    true;

            } else {

                option.textContent =
                    horario;

            }


            campoHorario.appendChild(
                option
            );

        }
    );

}


// ============================================
// MUDANÇA DA DATA
// ============================================

campoData.addEventListener(
    "change",
    carregarHorarios
);

// ============================================
// FORMATAR DATA
// ============================================

function formatarDataBonita(
    data
) {

    const partes =
        data.split("-");


    const ano =
        partes[0];

    const mes =
        partes[1];

    const dia =
        partes[2];


    const dataObj =
        new Date(
            ano,
            Number(mes) - 1,
            dia
        );


    return dataObj.toLocaleDateString(
        "pt-BR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );

}


// ============================================
// CONTA DO CLIENTE (login)
// Só aparece em "Meus horários" o agendamento feito COM LOGIN.
// Aqui detectamos a sessão, preenchemos nome/WhatsApp e avisamos
// o visitante que precisa entrar na conta.
// ============================================

let sessaoCliente = null;

async function iniciarConta() {

    const aviso =
        document.getElementById("contaAviso");

    if (!aviso) return;

    try {

        const { data } =
            await supabaseClient.auth.getSession();

        sessaoCliente =
            data && data.session
                ? data.session
                : null;

    } catch (e) {

        sessaoCliente = null;

    }

    aviso.hidden = false;

    if (!sessaoCliente) {

        aviso.textContent =
            "Para confirmar, você entra na sua conta (ou cria uma) no próximo passo. Sua escolha fica salva.";

        return;
    }

    aviso.textContent =
        "Agendando como " + (sessaoCliente.user.email || "cliente") +
        ". Este horário aparecerá em Meus horários.";

    try {

        const { data: perfil } =
            await supabaseClient
                .from("clientes")
                .select("nome, whatsapp")
                .eq("user_id", sessaoCliente.user.id)
                .maybeSingle();

        if (perfil) {

            if (!campoNome.value)
                campoNome.value = perfil.nome || "";

            if (!campoWhatsapp.value) {

                campoWhatsapp.value = perfil.whatsapp || "";

                campoWhatsapp.dispatchEvent(
                    new Event("input")
                );

            }

        } else {

            aviso.innerHTML =
                'Sua conta ainda não tem cadastro completo. ' +
                '<a href="cliente.html">Complete em Meus horários</a> ' +
                'para que seus agendamentos apareçam lá.';

        }

    } catch (e) {

        console.error("Erro ao carregar perfil:", e);

    }

}

iniciarConta();


// ============================================
// LOGIN OBRIGATÓRIO PARA CONFIRMAR
// A escolha (serviço, data, horário) fica nos campos da
// página; o login abre no mesmo painel, sem recarregar nada. Depois do
// login/cadastro o MESMO agendamento é confirmado.
// ============================================

const painelAgendar = document.getElementById("dw");
const gate = document.getElementById("authGate");
const RASCUNHO_KEY = "studio_rascunho_agendamento";

// Usuário validado no servidor (não confia só no que está no navegador).
async function obterUsuarioLogado() {

    try {

        const { data: { user }, error } =
            await supabaseClient.auth.getUser();

        if (error || !user) return null;

        return user;

    } catch (e) {

        return null;

    }

}

// Guarda a escolha para o caso do e-mail de confirmação abrir em outra aba.
function salvarRascunho() {

    try {

        localStorage.setItem(RASCUNHO_KEY, JSON.stringify({
            procedimento: campoProcedimento.value,
            data: campoData.value,
            horario: campoHorario.value,
            ts: Date.now()
        }));

    } catch (e) { /* sem armazenamento: segue sem rascunho */ }

}

function limparRascunho() {

    try { localStorage.removeItem(RASCUNHO_KEY); } catch (e) { }

}

function traduzErroAuth(err) {

    const m = ((err && (err.message || err.error_description)) || "").toLowerCase();

    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("not confirmed")) return "Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada (e no spam).";
    if (m.includes("already registered") || m.includes("already been registered")) return "Já existe uma conta com esse e-mail. Entre ou recupere a senha.";
    if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
    if (m.includes("password") && (m.includes("least") || m.includes("weak") || m.includes("short"))) return "Senha fraca. Use pelo menos 8 caracteres.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão. Verifique a internet e tente de novo.";
    if (m.includes("invalid") && m.includes("email")) return "Informe um e-mail válido.";

    return "Não foi possível concluir. Tente novamente.";

}

if (gate) {

    const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
    const erroDe = f => f.querySelector("[data-erro]");
    const setErro = (f, t) => { erroDe(f).textContent = t || ""; };
    const gateOk = document.getElementById("gateOk");
    const gateSub = document.getElementById("gateSub");
    const gcWa = document.getElementById("gcWa");

    function modoGate(modo) {

        gate.querySelectorAll("[data-gf]").forEach(f => {
            f.hidden = f.dataset.gf !== modo;
            setErro(f, "");
        });

        gate.querySelectorAll(".gate-tab").forEach(t => {
            const on = t.dataset.gate === modo;
            t.classList.toggle("on", on);
            t.setAttribute("aria-selected", on);
        });

        document.getElementById("gateTitulo").textContent =
            modo === "criar" ? "Crie sua conta" : "Entre para confirmar";

        gateOk.hidden = true;

    }

    // Abre o login no lugar do formulário (a escolha continua nos campos).
    window.abrirLogin = function (aviso) {

        salvarRascunho();

        gateSub.textContent =
            aviso || "Para finalizar, entre na sua conta ou crie uma. Seu serviço, dia e horário continuam salvos.";

        // Aproveita o que já foi digitado no passo "Seus dados"
        document.getElementById("gcNome").value = campoNome.value;
        gcWa.value = campoWhatsapp.value;

        modoGate("entrar");

        gate.hidden = false;
        painelAgendar.classList.add("gate-on");
        painelAgendar.querySelector(".dw-p").scrollTo({ top: 0 });

        mensagem.textContent = "";

        setTimeout(() => document.getElementById("gEmail").focus({ preventScroll: true }), 250);

    };

    function fecharLogin() {

        gate.hidden = true;
        painelAgendar.classList.remove("gate-on");

    }

    // Logou: fecha o login, atualiza o aviso e confirma o MESMO agendamento.
    async function aposLogin() {

        limparRascunho();
        fecharLogin();
        await iniciarConta();
        formulario.requestSubmit();

    }

    gate.querySelector(".gate-tabs").addEventListener("click", e => {
        const t = e.target.closest(".gate-tab");
        if (t) modoGate(t.dataset.gate);
    });

    document.getElementById("gateVoltar").addEventListener("click", fecharLogin);

    // máscara do WhatsApp (mesma do formulário)
    gcWa.addEventListener("input", () => {
        const v = gcWa.value.replace(/\D/g, "").substring(0, 11);
        gcWa.value = v.length <= 2 ? (v ? `(${v}` : "")
            : v.length <= 7 ? `(${v.substring(0, 2)}) ${v.substring(2)}`
                : `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
    });

    // ----- entrar -----
    document.getElementById("gateEntrar").addEventListener("submit", async e => {

        e.preventDefault();

        const f = e.target;
        const email = document.getElementById("gEmail").value.trim();
        const senha = document.getElementById("gSenha").value;

        if (!emailOk(email) || !senha) return setErro(f, "Informe e-mail e senha.");

        const btn = f.querySelector("[type=submit]");
        btn.disabled = true; setErro(f, "");

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });

        btn.disabled = false;

        if (error) return setErro(f, traduzErroAuth(error));

        f.reset();
        await aposLogin();

    });

    // ----- criar conta -----
    document.getElementById("gateCriar").addEventListener("submit", async e => {

        e.preventDefault();

        const f = e.target;
        const nome = document.getElementById("gcNome").value.trim();
        const wa = gcWa.value.replace(/\D/g, "");
        const email = document.getElementById("gcEmail").value.trim();
        const senha = document.getElementById("gcSenha").value;

        if (!nome) return setErro(f, "Informe seu nome.");
        if (wa.length < 10 || wa.length > 13) return setErro(f, "Informe um WhatsApp válido, com DDD.");
        if (!emailOk(email)) return setErro(f, "Informe um e-mail válido.");
        if (senha.length < 8) return setErro(f, "A senha precisa ter pelo menos 8 caracteres.");

        const btn = f.querySelector("[type=submit]");
        btn.disabled = true; setErro(f, "");

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password: senha,
            options: {
                data: { tipo: "cliente", nome, whatsapp: wa },
                emailRedirectTo: location.href.split("#")[0]
            }
        });

        btn.disabled = false;

        if (error) return setErro(f, traduzErroAuth(error));

        // e-mail já cadastrado (com confirmação ligada o Supabase devolve usuário "vazio")
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return setErro(f, traduzErroAuth({ message: "User already registered" }));
        }

        // Já usa o que foi digitado no cadastro nos dados do agendamento
        campoNome.value = nome;
        campoWhatsapp.value = wa;
        campoWhatsapp.dispatchEvent(new Event("input"));

        f.reset();

        if (data.session) {

            // confirmação de e-mail desligada: já está logado
            await aposLogin();
            return;

        }

        // confirmação de e-mail ligada: pede para confirmar e depois entrar
        modoGate("entrar");
        gateOk.textContent =
            "Conta criada! Enviamos um link de confirmação para o seu e-mail. " +
            "Confirme e depois entre aqui para finalizar o agendamento.";
        gateOk.hidden = false;
        document.getElementById("gEmail").value = email;

    });

    // ----- recuperar senha (a nova senha é definida em cliente.html) -----
    document.getElementById("gateEsqueci").addEventListener("click", async () => {

        const f = document.getElementById("gateEntrar");
        const email = document.getElementById("gEmail").value.trim();

        if (!emailOk(email)) return setErro(f, "Informe seu e-mail acima para receber o link.");

        setErro(f, "");

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: new URL("cliente.html", location.href).href
        });

        if (error) return setErro(f, traduzErroAuth(error));

        gateOk.textContent = "Se existir uma conta com esse e-mail, enviamos o link para criar uma nova senha.";
        gateOk.hidden = false;

    });

}

// Mantém o aviso e o estado da sessão em dia (login, logout, sessão expirada)
supabaseClient.auth.onAuthStateChange((evento) => {

    if (evento === "SIGNED_OUT") {
        sessaoCliente = null;
        setTimeout(iniciarConta, 0);
    }

});


// ============================================
// MOSTRAR CONFIRMAÇÃO
// ============================================

async function mostrarConfirmacao(
    nome,
    procedimento,
    data,
    horario
) {
    const valor = await obterPrecoServico(procedimento);
    const confirmacaoValor = document.getElementById("confirmacaoValor");

    if (confirmacaoValor) {
        confirmacaoValor.textContent =
            valor === null ? "Valor não disponível" : formatarMoeda(valor);
    }

    confirmacaoNome.textContent =
        nome;


    confirmacaoProcedimento.textContent =
        procedimento;


    confirmacaoData.textContent =
        formatarDataBonita(data);


    confirmacaoHorario.textContent =
        horario;


    // Mensagem que será aberta no WhatsApp

    const mensagemWhatsApp =
        `Olá! Acabei de realizar um agendamento no MARGEM AUTO.

Nome: ${nome}
Serviço: ${procedimento}
Data: ${formatarDataBonita(data)}
Horário: ${horario}

Gostaria de confirmar meu agendamento.`;


    const linkWhatsApp =
        `https://wa.me/${WHATSAPP_EMPRESA}?text=${encodeURIComponent(
            mensagemWhatsApp
        )}`;


    btnWhatsApp.href =
        linkWhatsApp;


    // Esconde formulário

    formulario.style.display =
        "none";


    // Mostra confirmação

    confirmacao.style.display =
        "block";


    // Esconde mensagem

    mensagem.textContent =
        "";

}


// ============================================
// AGENDAMENTO
// ============================================

formulario.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const nome =
            campoNome.value.trim();

        const whatsapp =
            campoWhatsapp.value
                .replace(/\D/g, "");



        const procedimento =
            campoProcedimento.value;


        const data =
            campoData.value;


        const horario =
            campoHorario.value;


        // =====================================
        // VALIDAÇÃO
        // =====================================

        if (
            !nome ||
            !whatsapp ||
            !procedimento ||
            !data ||
            !horario
        ) {

            mostrarMensagem(
                "Preencha todos os campos.",
                "erro"
            );

            return;
        }


        const digitosWhatsapp =
            whatsapp.replace(/\D/g, "");

        if (
            digitosWhatsapp.length < 10 ||
            digitosWhatsapp.length > 13
        ) {

            mostrarMensagem(
                "Informe um WhatsApp válido, com DDD.",
                "erro"
            );

            return;
        }


        // =====================================
        // BOTÃO
        // =====================================

        btnAgendar.disabled =
            true;


        btnAgendar.textContent =
            "Agendando...";


        // =====================================
        // LOGIN OBRIGATÓRIO
        // O usuário vem do Supabase Auth (validado no servidor).
        // Sem login: NÃO cria nada, abre o login e mantém a escolha.
        // =====================================

        const usuario =
            await obterUsuarioLogado();

        if (!usuario) {

            restaurarBotao();

            abrirLogin(
                sessaoCliente
                    ? "Sua sessão expirou. Entre novamente para confirmar."
                    : ""
            );

            return;
        }


        // =====================================
        // VERIFICAR HORÁRIO NOVAMENTE
        // =====================================

        const {
            horarios: ocupadosAgora,
            error: erroVerificacao
        } = await buscarHorariosOcupados(
            data
        );


        if (erroVerificacao) {

            console.error(
                erroVerificacao
            );


            mostrarMensagem(
                "Não foi possível verificar o horário.",
                "erro"
            );


            restaurarBotao();

            return;
        }


        if (
            ocupadosAgora.includes(horario)
        ) {

            mostrarMensagem(
                "Esse horário acabou de ser ocupado. Escolha outro.",
                "erro"
            );


            await carregarHorarios();


            restaurarBotao();

            return;
        }


        // =====================================
        // SALVAR
        // =====================================

        let error = null;

        // Função segura do banco: grava user_id = auth.uid() (o id vem da
        // sessão no servidor, nunca do navegador) e protege contra horário duplo.
        const { data: res, error: erroRpc } =
            await supabaseClient.rpc(
                "criar_agendamento",
                {
                    p_nome: nome,
                    p_whatsapp: whatsapp,
                    p_procedimento: procedimento,
                    p_data: data,
                    p_horario: horario
                }
            );

        if (!erroRpc && res === "ok") {

            error = null;

        } else if (!erroRpc && res === "ocupado") {

            error = { code: "23505" };

        } else if (!erroRpc && res === "login") {

            restaurarBotao();

            abrirLogin("Sua sessão expirou. Entre novamente para confirmar.");

            return;

        } else if (!erroRpc && res === "servico_indisponivel") {

            mostrarMensagem(
                "Esse serviço não está disponível no momento. Escolha outro.",
                "erro"
            );

            restaurarBotao();

            return;

        } else if (!erroRpc && res === "invalido") {

            mostrarMensagem(
                "Confira os dados do agendamento e tente de novo.",
                "erro"
            );

            restaurarBotao();

            return;

        } else {

            console.error(
                "criar_agendamento falhou:",
                erroRpc || res
            );

            error = erroRpc || { code: "rpc", message: String(res) };

        }


        // =====================================
        // ERRO
        // =====================================

        if (error) {

            if (error.code === "23505") {

                mostrarMensagem(
                    "Esse horário acabou de ser ocupado. Escolha outro.",
                    "erro"
                );

                await carregarHorarios();

                restaurarBotao();

                return;
            }


            console.error(
                "Erro ao criar agendamento:",
                error
            );


            mostrarMensagem(
                "Não foi possível realizar o agendamento.",
                "erro"
            );


            restaurarBotao();

            return;
        }


        // =====================================
        // SUCESSO
        // =====================================

        formulario.reset();


        campoHorario.innerHTML = `

            <option value="">
                Selecione uma data primeiro
            </option>

        `;


        restaurarBotao();


        await mostrarConfirmacao(
            nome,
            procedimento,
            data,
            horario
        );


        const avisoConta =
            document.getElementById("confirmacaoConta");

        if (avisoConta) {

            avisoConta.hidden = false;

            avisoConta.innerHTML =
                'Ele já está em <a href="cliente.html">Meus horários</a>.';

        }

    }
);


// ============================================
// RESTAURAR BOTÃO
// ============================================

function restaurarBotao() {

    btnAgendar.disabled =
        false;


    btnAgendar.textContent =
        "Confirmar agendamento";

}


// ============================================
// MENSAGEM
// ============================================

function mostrarMensagem(
    texto,
    tipo
) {

    mensagem.textContent =
        texto;


    mensagem.className =
        tipo;

}


// ============================================
// NOVO AGENDAMENTO
// ============================================

novoAgendamento.addEventListener(
    "click",
    () => {

        confirmacao.style.display =
            "none";


        formulario.style.display =
            "block";


        campoHorario.innerHTML = `

            <option value="">
                Selecione uma data primeiro
            </option>

        `;


        mensagem.textContent =
            "";

    }
);