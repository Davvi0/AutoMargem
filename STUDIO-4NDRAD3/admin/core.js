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


// ============================================
// ELEMENTOS - AGENDA
// ============================================

const listaAgendamentos =
    document.getElementById("listaAgendamentos");

const totalAgendamentos =
    document.getElementById("totalAgendamentos");

const totalConfirmados =
    document.getElementById("totalConfirmados");

const totalLivres =
    document.getElementById("totalLivres");

const tituloData =
    document.getElementById("tituloData");

const dataSelecionada =
    document.getElementById("dataSelecionada");

const mesAtual =
    document.getElementById("mesAtual");

const btnAnterior =
    document.getElementById("btnAnterior");

const btnProximo =
    document.getElementById("btnProximo");

const btnHoje =
    document.getElementById("btnHoje");

const btnSair =
    document.getElementById("btnSair");


// ============================================
// NAVEGAÇÃO
// ============================================

const navAgenda =
    document.getElementById("navAgenda");

const navReativacao =
    document.getElementById("navReativacao");

const navFinanceiro =
    document.getElementById("navFinanceiro");

const paginaAgenda =
    document.getElementById("paginaAgenda");

const paginaReativacao =
    document.getElementById("paginaReativacao");

const paginaFinanceiro =
    document.getElementById("paginaFinanceiro");

const navClientes =
    document.getElementById("navClientes");

const paginaClientes =
    document.getElementById("paginaClientes");


// ============================================
// REATIVAÇÃO
// ============================================

const listaReativacao =
    document.getElementById("listaReativacao");

const totalReativacao =
    document.getElementById("totalReativacao");


// ============================================
// MODAL AGENDAMENTO
// ============================================

const modalAgendamento =
    document.getElementById("modalAgendamento");

const fecharModal =
    document.getElementById("fecharModal");

const cancelarModal =
    document.getElementById("cancelarModal");

const formAgendamento =
    document.getElementById("formAgendamento");

const horarioModal =
    document.getElementById("horarioModal");

const nomeCliente =
    document.getElementById("nomeCliente");

const whatsappCliente =
    document.getElementById("whatsappCliente");

const procedimentoCliente =
    document.getElementById("procedimentoCliente");

// ============================================
// IMPRESSÃO
// ============================================

const btnImprimir =
    document.getElementById("btnImprimir");

const areaImpressao =
    document.getElementById("areaImpressao");


// ============================================
// FINANCEIRO
// ============================================

const mesFinanceiroEl =
    document.getElementById("mesFinanceiro");

const btnMesAnterior =
    document.getElementById("btnMesAnterior");

const btnMesProximo =
    document.getElementById("btnMesProximo");

const btnNovaDespesa =
    document.getElementById("btnNovaDespesa");

const listaEntradas =
    document.getElementById("listaEntradas");

const listaDespesas =
    document.getElementById("listaDespesas");

const totalFaturamento =
    document.getElementById("totalFaturamento");

const totalDespesas =
    document.getElementById("totalDespesas");

const totalSaldo =
    document.getElementById("totalSaldo");

const modalDespesa =
    document.getElementById("modalDespesa");

const fecharModalDespesa =
    document.getElementById("fecharModalDespesa");

const cancelarModalDespesa =
    document.getElementById("cancelarModalDespesa");

const formDespesa =
    document.getElementById("formDespesa");

const descricaoDespesa =
    document.getElementById("descricaoDespesa");

const categoriaDespesa =
    document.getElementById("categoriaDespesa");

const valorDespesa =
    document.getElementById("valorDespesa");

const dataDespesa =
    document.getElementById("dataDespesa");


// ============================================
// VARIÁVEIS
// ============================================

let dataAtual = new Date();

let horarioSelecionado = null;

let agendamentosDoDiaAtual = [];

let mesFinanceiroAtual = new Date();

let usuarioAtual = null;


// ============================================
// HORÁRIOS
// ============================================

const horarios = [
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
// MOEDA
// ============================================

const formatadorMoeda =
    new Intl.NumberFormat(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );


function formatarMoeda(valor) {

    return formatadorMoeda.format(
        Number(valor) || 0
    );

}

// ============================================
// ESCAPAR HTML
// Evita XSS: nome, procedimento etc. vêm do
// formulário público e nunca podem virar HTML.
// ============================================

function escaparHtml(valor) {

    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}

// ============================================
// WHATSAPP: DDI 55 SEM DUPLICAR
// ============================================

function numeroComDdi(numero) {

    return (
        numero.startsWith("55") &&
        numero.length >= 12
    )
        ? numero
        : `55${numero}`;

}


// ============================================
// VERIFICAR LOGIN
// ============================================

async function verificarLogin() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();


    if (error) {

        console.error(
            "Erro ao verificar login:",
            error
        );

        window.location.href = "login/login.html";

        return false;
    }


    if (!user) {

        window.location.href = "login/login.html";

        return false;
    }


    // Contas de cliente (Área do cliente) não acessam o painel.
    // (A proteção real dos dados é o RLS por e-mail; isto só evita a tela vazia.)
    if (typeof adminConfigurado === "function" && adminConfigurado()) {

        if (!souAdmin(user.email)) {
            window.location.href = "../public/cliente.html";
            return false;
        }

        usuarioAtual = user;
        return true;
    }

    try {
        const { data: perfilCliente } = await supabaseClient
            .from("clientes")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (perfilCliente) {
            window.location.href = "../public/cliente.html";
            return false;
        }
    } catch (e) { /* tabela ainda não criada: segue normal */ }

    usuarioAtual = user;

    return true;
}


// ============================================
// FORMATAR DATA
// ============================================

function formatarData(data) {

    const ano =
        data.getFullYear();

    const mes =
        String(
            data.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            data.getDate()
        ).padStart(2, "0");


    return `${ano}-${mes}-${dia}`;
}


// ============================================
// DATA BONITA
// ============================================

function formatarDataBonita(data) {

    const dataObj =
        data instanceof Date
            ? data
            : new Date(`${data}T00:00:00`);


    return dataObj.toLocaleDateString(
        "pt-BR",
        {
            weekday: "long",
            day: "numeric",
            month: "long"
        }
    );
}


// ============================================
// CABEÇALHO
// ============================================

function atualizarCabecalho() {

    if (mesAtual) {

        mesAtual.textContent =
            dataAtual.toLocaleDateString(
                "pt-BR",
                {
                    month: "long",
                    year: "numeric"
                }
            );
    }


    if (dataSelecionada) {

        dataSelecionada.textContent =
            dataAtual.toLocaleDateString(
                "pt-BR",
                {
                    day: "numeric",
                    month: "long"
                }
            );
    }


    if (tituloData) {

        tituloData.textContent =
            formatarDataBonita(
                dataAtual
            );
    }
}


// ============================================
// CARREGAR AGENDA
// ============================================

async function carregarAgenda() {

    atualizarCabecalho();


    if (!listaAgendamentos) {
        return;
    }


    listaAgendamentos.innerHTML = `
        <div class="loading">
            Carregando agenda...
        </div>
    `;


    const data =
        formatarData(dataAtual);


    // IMPORTANTE:
    // NÃO usamos .eq("user_id", ...)
    // porque agendamentos não possuem user_id.

    const {
        data: agendamentos,
        error
    } = await supabaseClient

        .from("agendamentos")

        .select("*")

        .eq("data", data)

        .neq("status", "cancelado")

        .order(
            "horario",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "Erro ao carregar agenda:",
            error
        );


        listaAgendamentos.innerHTML = `
            <div class="empty">
                Não foi possível carregar a agenda.
                <br><br>
                Verifique as políticas RLS da tabela
                "agendamentos" no Supabase.
            </div>
        `;

        return;
    }


    agendamentosDoDiaAtual =
        agendamentos || [];


    atualizarResumo(
        agendamentosDoDiaAtual
    );


    mostrarAgendamentos(
        agendamentosDoDiaAtual
    );
}


// ============================================
// RESUMO
// ============================================

function atualizarResumo(agendamentos) {

    const total =
        agendamentos.length;


    const confirmados =
        agendamentos.filter(
            item =>
                item.status === "confirmado"
        ).length;


    const livres =
        Math.max(
            horarios.length - confirmados,
            0
        );


    if (totalAgendamentos) {
        totalAgendamentos.textContent =
            total;
    }


    if (totalConfirmados) {
        totalConfirmados.textContent =
            confirmados;
    }


    if (totalLivres) {
        totalLivres.textContent =
            livres;
    }
}


// ============================================
// MOSTRAR AGENDA
// ============================================

function mostrarAgendamentos(agendamentos) {

    listaAgendamentos.innerHTML = "";


    horarios.forEach(horario => {

        const doHorario =
            agendamentos
                .filter(
                    item =>
                        item.horario &&
                        item.horario.substring(0, 5) ===
                        horario
                );

        const ocupados =
            doHorario.filter(
                item => item.status === "confirmado"
            ).length;


        // ====================================
        // HORÁRIO LIVRE
        // ====================================

        if (!doHorario.length) {

            const card =
                document.createElement("div");


            card.className =
                "agendamento horario-livre";


            card.innerHTML = `

                <div class="horario">
                    ${horario}
                </div>

                <div>

                    <div class="cliente-nome">
                        Horário livre
                    </div>

                    <div class="info">
                        Nenhum agendamento neste horário.
                    </div>

                    <button class="btn-agendar">
                        + Agendar
                    </button>

                </div>
            `;


            card
                .querySelector(".btn-agendar")
                .addEventListener(
                    "click",
                    () => abrirModal(horario)
                );


            listaAgendamentos.appendChild(card);

            return;
        }


        doHorario.forEach(agendamento => {

        // ====================================
        // DADOS
        // ====================================

        const nome =
            agendamento.nome ||
            "Cliente";


        const procedimento =
            agendamento.procedimento ||
            "Não informado";


        const whatsapp =
            agendamento.whatsapp ||
            "";


        const status =
            agendamento.status ||
            "confirmado";


        const valor =
            agendamento.valor;


        const valorTexto =
            valor === null ||
            valor === undefined
                ? "Sem preço definido (cadastre na aba Preços)"
                : formatarMoeda(valor);


        // ====================================
        // CARD
        // ====================================

        const card =
            document.createElement("div");


        card.className =
            "agendamento";


        card.innerHTML = `

            <div class="horario">
                ${horario}
            </div>

            <div>

                <div class="cliente-nome">
                    ${escaparHtml(nome)}
                </div>

                <div class="info">
                    <strong>Procedimento:</strong>
                    ${escaparHtml(procedimento)}
                </div>

                <div class="info">
                    <strong>WhatsApp:</strong>
                    ${escaparHtml(whatsapp || "Não informado")}
                </div>

                <div class="info info-valor">
                    <strong>Valor:</strong>
                    ${valorTexto}
                </div>

                <span class="status status-${escaparHtml(status)}">
                    ${escaparHtml(status)}
                </span>

                <div class="botoes">

                    <button class="btn-compareceu">
                        Compareceu
                    </button>

                    <button class="btn-faltou">
                        Faltou
                    </button>

                    <button class="btn-cancelar">
                        Cancelar
                    </button>

                    <button class="btn-lembrete">
                        💬 Enviar lembrete
                    </button>

                </div>

            </div>
        `;


        // ====================================
        // BOTÕES
        // ====================================

        card
            .querySelector(".btn-compareceu")
            .addEventListener(
                "click",
                () =>
                    atualizarStatus(
                        agendamento.id,
                        "compareceu"
                    )
            );


        card
            .querySelector(".btn-faltou")
            .addEventListener(
                "click",
                () =>
                    atualizarStatus(
                        agendamento.id,
                        "faltou"
                    )
            );


        card
            .querySelector(".btn-cancelar")
            .addEventListener(
                "click",
                () => {

                    const confirmar =
                        confirm(
                            "Deseja cancelar este agendamento?"
                        );


                    if (!confirmar) {
                        return;
                    }


                    atualizarStatus(
                        agendamento.id,
                        "cancelado"
                    );
                }
            );


        card
            .querySelector(".btn-lembrete")
            .addEventListener(
                "click",
                () =>
                    enviarLembrete(
                        nome,
                        whatsapp,
                        procedimento,
                        horario
                    )
            );


        listaAgendamentos.appendChild(card);

        });


        // Horário livre: oferece agendar
        if (ocupados < 1) {

            const livre =
                document.createElement("div");

            livre.className =
                "agendamento horario-livre";

            livre.innerHTML = `
                <div class="horario">${horario}</div>
                <div>
                    <div class="info">
                        Horário livre para novo agendamento.
                    </div>
                    <button class="btn-agendar">+ Agendar</button>
                </div>
            `;

            livre
                .querySelector(".btn-agendar")
                .addEventListener(
                    "click",
                    () => abrirModal(horario)
                );

            listaAgendamentos.appendChild(livre);
        }

    });
}


// ============================================
// LEMBRETE WHATSAPP
// ============================================

function enviarLembrete(
    nome,
    whatsapp,
    procedimento,
    horario
) {

    if (!whatsapp) {

        alert(
            "Este cliente não possui WhatsApp cadastrado."
        );

        return;
    }


    const numero =
        whatsapp.replace(/\D/g, "");


    if (!numero) {

        alert(
            "Número de WhatsApp inválido."
        );

        return;
    }


    const data =
        dataAtual.toLocaleDateString(
            "pt-BR"
        );


    const mensagem =
        `Olá, ${nome}! 😊

Passando para lembrar do seu horário no MARGEM AUTO.

📅 Data: ${data}
🕐 Horário: ${horario}
✨ Procedimento: ${procedimento}

Te esperamos! 💚`;


    const link =
        `https://wa.me/${numeroComDdi(numero)}?text=${encodeURIComponent(
            mensagem
        )}`;


    window.open(
        link,
        "_blank"
    );
}


// ============================================
// ATUALIZAR STATUS
// ============================================

async function atualizarStatus(
    id,
    novoStatus
) {

    const {
        error
    } = await supabaseClient

        .from("agendamentos")

        .update({
            status: novoStatus
        })

        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Erro ao atualizar status:",
            error
        );


        alert(
            "Não foi possível atualizar o status."
        );

        return;
    }


    await carregarAgenda();

    await carregarClientesParaReativar();
}


// ============================================
// MODAL AGENDAMENTO
// ============================================

function abrirModal(horario) {

    horarioSelecionado =
        horario;


    horarioModal.textContent =
        `Horário: ${horario}`;


    modalAgendamento.classList.add(
        "aberto"
    );


    carregarServicosModal();

    nomeCliente.focus();
}


// Serviços (tabela única de preços) para sugerir no campo Procedimento
async function carregarServicosModal() {
    const lista = document.getElementById("servicosLista");
    if (!lista) return;

    const { data, error } = await supabaseClient.rpc("servicos_catalogo");

    if (error || !Array.isArray(data)) return;

    lista.innerHTML = data.map(item =>
        `<option value="${escaparHtml(item.servico)}"></option>`
    ).join("");
}

function fecharModalAgendamento() {

    modalAgendamento.classList.remove(
        "aberto"
    );


    formAgendamento.reset();


    horarioSelecionado =
        null;
}


fecharModal.addEventListener(
    "click",
    fecharModalAgendamento
);


cancelarModal.addEventListener(
    "click",
    fecharModalAgendamento
);


// ============================================
// PREÇO DO SERVIÇO (definido somente na aba Preços)
// ============================================

async function buscarPrecoServico(procedimento) {

    try {
        const { data, error } = await supabaseClient.rpc(
            "preco_admin_agendamento",
            {
                p_servico: procedimento
            }
        );

        if (error) {
            console.error("Erro ao buscar preço do serviço:", error);
            return null;
        }

        return data === null || data === undefined ? null : Number(data);
    } catch (e) {
        console.error(e);
        return null;
    }
}


// ============================================
// CRIAR AGENDAMENTO PELO ADMIN
// ============================================

formAgendamento.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!horarioSelecionado) {

            alert(
                "Selecione um horário."
            );

            return;
        }


        const nome =
            nomeCliente.value.trim();


        const whatsapp =
            whatsappCliente.value.trim();


        const procedimento =
            procedimentoCliente.value.trim();


        if (
            !nome ||
            !whatsapp ||
            !procedimento
        ) {

            alert(
                "Preencha todos os campos."
            );

            return;
        }


        const data =
            formatarData(dataAtual);


        const valor = await buscarPrecoServico(
            procedimento
        );

        if (valor === null) {
            alert("Esse serviço não está disponível ou ainda não possui preço definido (aba Preços).");
            return;
        }


        // ====================================
        // VERIFICAR DUPLICIDADE
        // ====================================

        const {
            data: existente,
            error: erroVerificacao
        } = await supabaseClient

            .from("agendamentos")

            .select("id")

            .eq(
                "data",
                data
            )

            .eq(
                "horario",
                horarioSelecionado
            )

            .eq(
                "status",
                "confirmado"
            )

            .limit(1);


        if (erroVerificacao) {

            console.error(
                erroVerificacao
            );


            alert(
                "Não foi possível verificar o horário."
            );

            return;
        }


        if (
            existente &&
            existente.length > 0
        ) {

            alert(
                "Este horário já está ocupado."
            );

            return;
        }


        // ====================================
        // INSERIR
        // ====================================

        const {
            error
        } = await supabaseClient

            .from("agendamentos")

            .insert({

                nome: nome,

                whatsapp: whatsapp,

                procedimento: procedimento,

                data: data,

                horario: horarioSelecionado,

                status: "confirmado",

                valor: valor

            });


        if (error) {

            console.error(
                "Erro:",
                error
            );


            alert(
                "Não foi possível criar o agendamento."
            );

            return;
        }


        alert(
            "Agendamento criado com sucesso!"
        );


        fecharModalAgendamento();


        await carregarAgenda();
    }
);



// ============================================
// REATIVAÇÃO
// ============================================

// Converte data + horário do Supabase para horário local
function dataHoraReativacao(agendamento) {
    const dataTexto = String(agendamento?.data || "").slice(0, 10);
    const partesData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataTexto);

    if (!partesData) return null;

    const horarioTexto = String(agendamento?.horario || "00:00").slice(0, 5);
    const partesHora = /^(\d{2}):(\d{2})$/.exec(horarioTexto);

    if (!partesHora) return null;

    const ano = Number(partesData[1]);
    const mes = Number(partesData[2]);
    const dia = Number(partesData[3]);
    const hora = Number(partesHora[1]);
    const minuto = Number(partesHora[2]);

    const resultado = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);

    if (
        resultado.getFullYear() !== ano ||
        resultado.getMonth() !== mes - 1 ||
        resultado.getDate() !== dia ||
        hora > 23 ||
        minuto > 59
    ) {
        return null;
    }

    return resultado;
}


// Normaliza o WhatsApp para identificar clientes duplicados
function normalizarWhatsAppReativacao(valor) {
    return String(valor || "")
        .replace(/\D/g, "")
        .replace(/^55(?=\d{10,11}$)/, "");
}


// ============================================
// CARREGAR CLIENTES PARA REATIVAÇÃO
// ============================================

async function carregarClientesParaReativar() {
    if (!listaReativacao) return;

    listaReativacao.innerHTML = `
        <div class="loading">Carregando clientes...</div>
    `;

    if (totalReativacao) {
        totalReativacao.textContent = "—";
    }

    try {
        const { data: agendamentos, error } = await supabaseClient
            .from("agendamentos")
            .select("nome,whatsapp,procedimento,data,horario,status")
            .in("status", ["compareceu", "confirmado"])
            .not("whatsapp", "is", null)
            .order("data", { ascending: false })
            .order("horario", { ascending: false });

        if (error) throw error;

        const agora = new Date();
        const clientesPorWhatsApp = new Map();

        (agendamentos || []).forEach(agendamento => {
            const whatsappOriginal = String(
                agendamento.whatsapp || ""
            ).trim();

            const chave = normalizarWhatsAppReativacao(
                whatsappOriginal
            );

            const quando = dataHoraReativacao(agendamento);

            const status = String(
                agendamento.status || ""
            ).trim().toLowerCase();

            if (!chave || chave.length < 10 || !quando) {
                return;
            }

            let cliente = clientesPorWhatsApp.get(chave);

            if (!cliente) {
                cliente = {
                    whatsapp: whatsappOriginal,
                    nome: agendamento.nome || "Cliente",
                    procedimento: agendamento.procedimento || "",
                    ultimoAtendimento: null,
                    temAgendamentoFuturo: false
                };
            }

            // Não reativar quem já possui um horário futuro
            if (status === "confirmado" && quando > agora) {
                cliente.temAgendamentoFuturo = true;
            }

            // Considerar comparecimentos e agendamentos confirmados
            // que já passaram como atendimentos anteriores
            const atendimentoPassado =
                quando <= agora &&
                (
                    status === "compareceu" ||
                    status === "confirmado"
                );

            if (
                atendimentoPassado &&
                (
                    !cliente.ultimoAtendimento ||
                    quando > cliente.ultimoAtendimento
                )
            ) {
                cliente.ultimoAtendimento = quando;
                cliente.whatsapp = whatsappOriginal;
                cliente.nome = agendamento.nome || cliente.nome || "Cliente";
                cliente.procedimento = agendamento.procedimento || "";
            }

            clientesPorWhatsApp.set(chave, cliente);
        });

        const clientesParaReativar = [];
        const umDia = 24 * 60 * 60 * 1000;

        clientesPorWhatsApp.forEach(cliente => {
            if (
                !cliente.ultimoAtendimento ||
                cliente.temAgendamentoFuturo
            ) {
                return;
            }

            const diasSemVoltar = Math.floor(
                (
                    agora.getTime() -
                    cliente.ultimoAtendimento.getTime()
                ) / umDia
            );

            if (diasSemVoltar >= 30) {
                clientesParaReativar.push({
                    ...cliente,
                    diasSemVoltar
                });
            }
        });

        clientesParaReativar.sort(
            (a, b) => b.diasSemVoltar - a.diasSemVoltar
        );

        if (totalReativacao) {
            totalReativacao.textContent = String(
                clientesParaReativar.length
            );
        }

        mostrarClientesParaReativar(clientesParaReativar);

    } catch (error) {
        console.error(
            "Erro ao carregar clientes para reativação:",
            error
        );

        listaReativacao.innerHTML = `
            <div class="empty">
                Não foi possível carregar os clientes para reativação.
                <br><br>
                ${escaparHtml(
                    error?.message ||
                    "Verifique a conexão e as permissões da tabela agendamentos no Supabase."
                )}
            </div>
        `;

        if (totalReativacao) {
            totalReativacao.textContent = "0";
        }
    }
}


// ============================================
// MOSTRAR CLIENTES
// ============================================

function mostrarClientesParaReativar(clientes) {
    if (!listaReativacao) return;

    listaReativacao.innerHTML = "";

    if (!clientes || clientes.length === 0) {
        listaReativacao.innerHTML = `
            <div class="empty">
                Nenhum cliente está há 30 dias ou mais sem retornar.
            </div>
        `;
        return;
    }

    clientes.forEach(cliente => {
        const card = document.createElement("div");

        card.className = "cliente-reativacao";

        const dataFormatada = cliente.ultimoAtendimento
            ? cliente.ultimoAtendimento.toLocaleDateString("pt-BR")
            : "—";

        card.innerHTML = `
            <div class="cliente-reativacao-info">

                <div class="cliente-reativacao-nome">
                    ${escaparHtml(cliente.nome || "Cliente")}
                </div>

                <div class="cliente-reativacao-procedimento">
                    ${escaparHtml(
                        cliente.procedimento || "Serviço não informado"
                    )}
                </div>

                <div class="cliente-reativacao-dias">
                    Último atendimento: ${escaparHtml(dataFormatada)}
                    · ${Number(cliente.diasSemVoltar) || 0}
                    dias sem retornar
                </div>

            </div>

            <button class="btn-reativar" type="button">
                💬 Reativar cliente
            </button>
        `;

        card.querySelector(".btn-reativar")
            .addEventListener("click", () => {
                abrirWhatsAppReativacao(cliente);
            });

        listaReativacao.appendChild(card);
    });
}


// ============================================
// WHATSAPP REATIVAÇÃO
// ============================================

function abrirWhatsAppReativacao(cliente) {
    const numero = String(
        cliente?.whatsapp || ""
    ).replace(/\D/g, "");

    if (!numero || numero.length < 10) {
        alert(
            "Este cliente não possui um WhatsApp válido cadastrado."
        );
        return;
    }

    const nome = String(
        cliente.nome || ""
    ).trim() || "tudo bem";

    const mensagem = `Olá, ${nome}! 😊

Aqui é da MARGEM AUTO. Faz ${cliente.diasSemVoltar} dias desde o último serviço do seu veículo${
        cliente.procedimento
            ? ` (${cliente.procedimento})`
            : ""
    }.

Estamos à disposição para cuidar dele novamente. Gostaria de consultar um horário? 🚘`;

    const link = `https://wa.me/${numeroComDdi(numero)}?text=${encodeURIComponent(mensagem)}`;

    window.open(link, "_blank", "noopener,noreferrer");
}


// ============================================
// FINANCEIRO
// ============================================

function limitesDoMes(data) {

    const ano =
        data.getFullYear();

    const mes =
        data.getMonth();


    const inicio =
        formatarData(
            new Date(
                ano,
                mes,
                1
            )
        );


    const fim =
        formatarData(
            new Date(
                ano,
                mes + 1,
                0
            )
        );


    return {
        inicio,
        fim
    };
}


function atualizarCabecalhoFinanceiro() {

    if (!mesFinanceiroEl) {
        return;
    }


    mesFinanceiroEl.textContent =
        mesFinanceiroAtual.toLocaleDateString(
            "pt-BR",
            {
                month: "long",
                year: "numeric"
            }
        );
}


// ============================================
// FATURAMENTO: só conta depois que o dia e o horário passaram
// (e nunca se o cliente faltou ou o agendamento foi cancelado)
// ============================================

function contaComoFaturamento(item) {

    if (!item || item.valor === null || item.valor === undefined) {
        return false;
    }

    const statusItem = String(item.status || "").trim().toLowerCase();

    if (statusItem === "cancelado" || statusItem === "faltou") {
        return false;
    }

    const [ano, mes, dia] = String(item.data).slice(0, 10).split("-").map(Number);
    const [hora, min] = String(item.horario || "00:00").slice(0, 5).split(":").map(Number);

    if (!ano || !mes || !dia) {
        return false;
    }

    const quando = new Date(ano, mes - 1, dia, hora || 0, min || 0, 0);

    return quando.getTime() <= Date.now();
}


// ============================================
// CARREGAR FINANCEIRO
// ============================================

async function carregarFinanceiro() {

    atualizarCabecalhoFinanceiro();


    listaEntradas.innerHTML = `
        <div class="loading">
            Carregando...
        </div>
    `;


    listaDespesas.innerHTML = `
        <div class="loading">
            Carregando...
        </div>
    `;


    if (!usuarioAtual) {
        return;
    }


    const {
        inicio,
        fim
    } =
        limitesDoMes(
            mesFinanceiroAtual
        );


    // ========================================
    // ENTRADAS
    // ========================================
    //
    // Aqui NÃO filtramos por user_id,
    // porque o valor vem dos agendamentos.
    //
    // O user_id fica somente em DESPESAS.
    // ========================================

    const {
        data: entradas,
        error: erroEntradas
    } =
        await supabaseClient

            .from("agendamentos")

            .select("*")

            .gte(
                "data",
                inicio
            )

            .lte(
                "data",
                fim
            )

            .not(
                "valor",
                "is",
                null
            )

            .neq(
                "status",
                "cancelado"
            )

            .neq(
                "status",
                "faltou"
            )

            .order(
                "data",
                {
                    ascending: false
                }
            );


    // ========================================
    // DESPESAS
    // ========================================

    const {
        data: despesas,
        error: erroDespesas
    } =
        await supabaseClient

            .from("despesas")

            .select("*")

            .eq(
                "user_id",
                usuarioAtual.id
            )

            .gte(
                "data",
                inicio
            )

            .lte(
                "data",
                fim
            )

            .order(
                "data",
                {
                    ascending: false
                }
            );


    if (
        erroEntradas ||
        erroDespesas
    ) {

        console.error(
            "Erro financeiro:",
            erroEntradas ||
            erroDespesas
        );


        listaEntradas.innerHTML = `
            <div class="empty">
                Não foi possível carregar as entradas.
            </div>
        `;


        listaDespesas.innerHTML = `
            <div class="empty">
                Não foi possível carregar as despesas.
                Verifique a tabela "despesas".
            </div>
        `;


        return;
    }


    const entradasValidas =
        (entradas || []).filter(contaComoFaturamento);


    const faturamento =
        entradasValidas.reduce(
            (soma, item) =>
                soma +
                Number(
                    item.valor || 0
                ),
            0
        );


    const totalDespesasValor =
        (despesas || []).reduce(
            (soma, item) =>
                soma +
                Number(
                    item.valor || 0
                ),
            0
        );


    totalFaturamento.textContent =
        formatarMoeda(
            faturamento
        );


    totalDespesas.textContent =
        formatarMoeda(
            totalDespesasValor
        );


    totalSaldo.textContent =
        formatarMoeda(
            faturamento -
            totalDespesasValor
        );


    mostrarEntradas(
        entradasValidas
    );


    mostrarDespesas(
        despesas || []
    );
}


// ============================================
// MOSTRAR ENTRADAS
// ============================================

function mostrarEntradas(
    entradas
) {

    if (entradas.length === 0) {

        listaEntradas.innerHTML = `
            <div class="empty">
                Nenhum atendimento realizado com valor neste mês ainda.
            </div>
        `;

        return;
    }


    listaEntradas.innerHTML = "";


    entradas.forEach(
        item => {

            const card =
                document.createElement("div");


            card.className =
                "cliente-reativacao";


            card.innerHTML = `

                <div class="cliente-reativacao-info">

                    <div class="cliente-reativacao-nome">
                        ${escaparHtml(item.nome || "Cliente")}
                    </div>

                    <div class="cliente-reativacao-procedimento">
                        ${escaparHtml(item.procedimento || "Não informado")}
                        ·
                        ${formatarDataBonita(item.data)}
                    </div>

                </div>

                <div class="valor-lancamento valor-positivo">
                    + ${formatarMoeda(item.valor)}
                </div>
            `;


            listaEntradas.appendChild(
                card
            );
        }
    );
}


// ============================================
// MOSTRAR DESPESAS
// ============================================

function mostrarDespesas(
    despesas
) {

    if (despesas.length === 0) {

        listaDespesas.innerHTML = `
            <div class="empty">
                Nenhuma despesa lançada neste mês.
            </div>
        `;

        return;
    }


    listaDespesas.innerHTML = "";


    despesas.forEach(
        item => {

            const card =
                document.createElement("div");


            card.className =
                "cliente-reativacao despesa-card";


            card.innerHTML = `

                <div class="cliente-reativacao-info">

                    <div class="cliente-reativacao-nome">
                        ${escaparHtml(item.descricao)}
                    </div>

                    <div class="cliente-reativacao-procedimento">
                        ${item.categoria ? escaparHtml(item.categoria) + " · " : ""}
                        ${formatarDataBonita(item.data)}
                    </div>

                </div>

                <div class="despesa-acoes">

                    <div class="valor-lancamento valor-negativo">
                        - ${formatarMoeda(item.valor)}
                    </div>

                    <button
                        class="btn-excluir-despesa"
                    >
                        Excluir
                    </button>

                </div>
            `;


            card
                .querySelector(
                    ".btn-excluir-despesa"
                )
                .addEventListener(
                    "click",
                    () =>
                        excluirDespesa(
                            item.id
                        )
                );


            listaDespesas.appendChild(
                card
            );
        }
    );
}


// ============================================
// EXCLUIR DESPESA
// ============================================

async function excluirDespesa(
    id
) {

    const confirmar =
        confirm(
            "Deseja excluir esta despesa?"
        );


    if (!confirmar) {
        return;
    }


    const {
        error
    } =
        await supabaseClient

            .from("despesas")

            .delete()

            .eq(
                "id",
                id
            )

            .eq(
                "user_id",
                usuarioAtual.id
            );


    if (error) {

        console.error(
            "Erro:",
            error
        );


        alert(
            "Não foi possível excluir a despesa."
        );

        return;
    }


    await carregarFinanceiro();
}


// ============================================
// NAVEGAÇÃO FINANCEIRO
// ============================================

navFinanceiro.addEventListener(
    "click",
    event => {

        event.preventDefault();

        mostrarPagina(
            "financeiro"
        );
    }
);


// ============================================
// MÊS ANTERIOR
// ============================================

btnMesAnterior.addEventListener(
    "click",
    () => {

        mesFinanceiroAtual =
            new Date(
                mesFinanceiroAtual.getFullYear(),
                mesFinanceiroAtual.getMonth() - 1,
                1
            );


        carregarFinanceiro();
    }
);


// ============================================
// MÊS PRÓXIMO
// ============================================

btnMesProximo.addEventListener(
    "click",
    () => {

        mesFinanceiroAtual =
            new Date(
                mesFinanceiroAtual.getFullYear(),
                mesFinanceiroAtual.getMonth() + 1,
                1
            );


        carregarFinanceiro();
    }
);


// ============================================
// MODAL NOVA DESPESA
// ============================================

function abrirModalDespesa() {

    dataDespesa.value =
        formatarData(
            new Date()
        );


    modalDespesa.classList.add(
        "aberto"
    );


    descricaoDespesa.focus();
}


function fecharModalDespesaFn() {

    modalDespesa.classList.remove(
        "aberto"
    );


    formDespesa.reset();
}


btnNovaDespesa.addEventListener(
    "click",
    abrirModalDespesa
);


fecharModalDespesa.addEventListener(
    "click",
    fecharModalDespesaFn
);


cancelarModalDespesa.addEventListener(
    "click",
    fecharModalDespesaFn
);


// ============================================
// CRIAR DESPESA
// ============================================

// ============================================
// CRIAR DESPESA
// ============================================

function mensagemErroAoSalvarDespesa(error) {
    const codigo = String(error?.code || "");
    const mensagem = String(
        error?.message || "Erro desconhecido."
    );

    if (
        codigo === "42P01" ||
        /relation .*despesas.* does not exist/i.test(mensagem)
    ) {
        return 'A tabela "despesas" ainda não existe. Execute o SQL de despesas no Supabase.';
    }

    if (
        codigo === "42501" ||
        /row-level security|permission denied|not authorized/i.test(mensagem)
    ) {
        return "O Supabase bloqueou o lançamento por falta de permissão. Verifique as políticas RLS da tabela despesas.";
    }

    if (
        codigo === "PGRST204" ||
        /column .*despesas.* does not exist/i.test(mensagem)
    ) {
        return 'A estrutura da tabela despesas está incorreta. Confira as colunas descricao, categoria, valor, data e user_id.';
    }

    return `Não foi possível salvar a despesa: ${mensagem}`;
}


formDespesa.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        // Dados do formulário
        const descricao = descricaoDespesa.value.trim();
        const categoria = categoriaDespesa.value.trim();
        const valor = Number(valorDespesa.value);
        const data = dataDespesa.value;

        const botaoSalvar = formDespesa.querySelector(
            'button[type="submit"]'
        );

        const textoOriginal =
            botaoSalvar?.textContent || "Salvar";


        // ====================================
        // VALIDAÇÃO
        // ====================================

        if (
            !descricao ||
            descricao.length > 160 ||
            !Number.isFinite(valor) ||
            valor <= 0 ||
            !data ||
            categoria.length > 80
        ) {
            alert(
                "Informe uma descrição válida, um valor maior que zero, uma data e uma categoria de até 80 caracteres."
            );

            return;
        }


        // ====================================
        // VERIFICAR USUÁRIO
        // ====================================

        if (!usuarioAtual?.id) {

            alert(
                "Sua sessão não foi encontrada. Saia do painel, entre novamente e tente salvar."
            );

            return;
        }


        // ====================================
        // BLOQUEAR BOTÃO
        // ====================================

        if (botaoSalvar) {

            botaoSalvar.disabled = true;
            botaoSalvar.textContent = "Salvando...";

        }


        let salvou = false;


        try {

            // ====================================
            // ENVIAR PARA O SUPABASE
            // ====================================

            const { error } = await supabaseClient

                .from("despesas")

                .insert({

                    descricao: descricao,

                    categoria: categoria || null,

                    valor: Number(valor.toFixed(2)),

                    data: data,

                    user_id: usuarioAtual.id

                });


            if (error) {
                throw error;
            }

            salvou = true;


        } catch (error) {

            console.error(
                "Erro ao salvar despesa:",
                error
            );

            alert(
                mensagemErroAoSalvarDespesa(error)
            );

        } finally {

            if (botaoSalvar) {

                botaoSalvar.disabled = false;
                botaoSalvar.textContent = textoOriginal;

            }

        }


        // ====================================
        // ATUALIZAR PAINEL
        // ====================================

        if (!salvou) {
            return;
        }


        // Fechar modal
        fecharModalDespesaFn();


        try {

            // Atualizar financeiro
            await carregarFinanceiro();

        } catch (error) {

            console.error(
                "Erro ao atualizar financeiro:",
                error
            );

            alert(
                "A despesa foi salva, mas não foi possível atualizar a lista. Atualize a página."
            );

        }


        // Atualizar Dashboard
        if (
            typeof window.carregarDashboard === "function"
        ) {

            window.carregarDashboard(true);

        }

    }
);

// ============================================
// IMPRIMIR AGENDA
// ============================================

function imprimirAgenda() {

    const ocupados =
        agendamentosDoDiaAtual
            .slice()
            .sort(
                (a, b) =>
                    (a.horario || "")
                        .localeCompare(
                            b.horario || ""
                        )
            );


    const linhas =
        ocupados.length === 0

            ? `
                <tr>
                    <td colspan="5">
                        Nenhum agendamento neste dia.
                    </td>
                </tr>
            `

            : ocupados
                .map(
                    item => `
                        <tr>

                            <td>
                                ${
                                    (
                                        item.horario ||
                                        "-"
                                    ).substring(
                                        0,
                                        5
                                    )
                                }
                            </td>

                            <td>
                                ${escaparHtml(item.nome || "-")}
                            </td>

                            <td>
                                ${escaparHtml(item.procedimento || "-")}
                            </td>

                            <td>
                                ${escaparHtml(item.whatsapp || "-")}
                            </td>

                            <td>
                                ${escaparHtml(item.status || "-")}
                            </td>

                        </tr>
                    `
                )
                .join("");


    areaImpressao.innerHTML = `

        <h1>
            MARGEM AUTO — Agenda do dia
        </h1>

        <h2>
            ${formatarDataBonita(dataAtual)}
        </h2>

        <table>

            <thead>

                <tr>

                    <th>Horário</th>

                    <th>Cliente</th>

                    <th>Procedimento</th>

                    <th>WhatsApp</th>

                    <th>Status</th>

                </tr>

            </thead>

            <tbody>
                ${linhas}
            </tbody>

        </table>
    `;


    window.print();
}


btnImprimir.addEventListener(
    "click",
    imprimirAgenda
);


// ============================================
// TROCAR PÁGINA
// ============================================

function mostrarPagina(
    pagina
) {
    document.getElementById("paginaDashboard").classList.remove("ativa");
    document.getElementById("navDashboard").classList.remove("active");
    document.getElementById("paginaPrecos").classList.remove("ativa");
    document.getElementById("navPrecos").classList.remove("active");
    if (paginaClientes) paginaClientes.classList.remove("ativa");
    if (navClientes) navClientes.classList.remove("active");
    if (pagina === "precos") {
        paginaAgenda.classList.remove("ativa");
        paginaReativacao.classList.remove("ativa");
        paginaFinanceiro.classList.remove("ativa");
        navAgenda.classList.remove("active");
        navReativacao.classList.remove("active");
        navFinanceiro.classList.remove("active");
        document.getElementById("paginaPrecos").classList.add("ativa");
        document.getElementById("navPrecos").classList.add("active");
        if (typeof carregarPrecos === "function") {
            carregarPrecos();
        }
        return;
    }

    if (pagina === "clientes") {
        if (!paginaClientes || !navClientes) return;

        paginaAgenda.classList.remove("ativa");
        paginaReativacao.classList.remove("ativa");
        paginaFinanceiro.classList.remove("ativa");
        paginaClientes.classList.add("ativa");

        navAgenda.classList.remove("active");
        navReativacao.classList.remove("active");
        navFinanceiro.classList.remove("active");
        navClientes.classList.add("active");

        if (typeof carregarClientes === "function") {
            carregarClientes();
        }
        return;
    }

    if (pagina === "dashboard") {
        document.getElementById("paginaDashboard").classList.add("ativa");
        document.getElementById("navDashboard").classList.add("active");
        paginaAgenda.classList.remove("ativa");
        paginaReativacao.classList.remove("ativa");
        paginaFinanceiro.classList.remove("ativa");
        navAgenda.classList.remove("active");
        navReativacao.classList.remove("active");
        navFinanceiro.classList.remove("active");
        if (typeof carregarDashboard === "function") {
            carregarDashboard();
        }
        return;
    }

    paginaAgenda.classList.remove(
        "ativa"
    );

    paginaReativacao.classList.remove(
        "ativa"
    );

    paginaFinanceiro.classList.remove(
        "ativa"
    );

    if (paginaClientes) {
        paginaClientes.classList.remove("ativa");
    }


    navAgenda.classList.remove(
        "active"
    );

    navReativacao.classList.remove(
        "active"
    );

    navFinanceiro.classList.remove(
        "active"
    );

    if (navClientes) {
        navClientes.classList.remove("active");
    }


    if (pagina === "agenda") {

        paginaAgenda.classList.add(
            "ativa"
        );

        navAgenda.classList.add(
            "active"
        );


        carregarAgenda();

        return;
    }


    if (pagina === "reativacao") {

        paginaReativacao.classList.add(
            "ativa"
        );

        navReativacao.classList.add(
            "active"
        );


        carregarClientesParaReativar();

        return;
    }


    if (pagina === "financeiro") {

        paginaFinanceiro.classList.add(
            "ativa"
        );

        navFinanceiro.classList.add(
            "active"
        );


        carregarFinanceiro();

        return;
    }
}


// ============================================
// CLIQUE AGENDA
// ============================================

navAgenda.addEventListener(
    "click",
    event => {

        event.preventDefault();

        mostrarPagina(
            "agenda"
        );
    }
);


// ============================================
// CLIQUE REATIVAÇÃO
// ============================================

navReativacao.addEventListener(
    "click",
    event => {

        event.preventDefault();

        mostrarPagina(
            "reativacao"
        );
    }
);

// ============================================
// DATA ANTERIOR
// ============================================

btnAnterior.addEventListener(
    "click",
    () => {

        dataAtual.setDate(
            dataAtual.getDate() - 1
        );


        carregarAgenda();
    }
);


// ============================================
// PRÓXIMO DIA
// ============================================

btnProximo.addEventListener(
    "click",
    () => {

        dataAtual.setDate(
            dataAtual.getDate() + 1
        );


        carregarAgenda();
    }
);


// ============================================
// HOJE
// ============================================

btnHoje.addEventListener(
    "click",
    () => {

        dataAtual =
            new Date();


        carregarAgenda();
    }
);


// ============================================
// SAIR
// ============================================

btnSair.addEventListener(
    "click",
    async () => {

        await supabaseClient
            .auth
            .signOut();


        window.location.href =
            "login/login.html";
    }
);


// ============================================
// INICIAR SISTEMA
// ============================================

async function iniciar() {

    const logado =
        await verificarLogin();


    if (!logado) {
        return;
    }


    await carregarAgenda();

    await carregarClientesParaReativar();
mostrarPagina("dashboard");
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
} else {
    iniciar();
}