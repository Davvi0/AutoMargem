// ============================================
// ABA CLIENTES — CRM simples baseado em agendamentos
// Não cria uma segunda fonte de dados: os clientes
// são consolidados diretamente de public.agendamentos.
// ============================================
(() => {
    const pag = document.getElementById("paginaClientes");
    const nav = document.getElementById("navClientes");
    if (!pag || !nav) return;

    const H = v => escaparHtml(v);
    let agendamentos = [];
    let clientes = [];
    let filtro = { busca:"", servico:"", periodo:"" };

    const hojeYmd = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    };
    const diasDesde = ymd => {
        if (!ymd) return Infinity;
        const a = new Date(`${ymd}T12:00:00`);
        const b = new Date(`${hojeYmd()}T12:00:00`);
        return Math.floor((b - a) / 86400000);
    };
    const dataBR = ymd => {
        if (!ymd) return "-";
        const [a,m,d] = String(ymd).split("-");
        return a && m && d ? `${d}/${m}/${a}` : ymd;
    };
    const normalizarWa = n => {
        let d = String(n || "").replace(/\D/g,"");
        if (!d) return "";
        if (!d.startsWith("55")) d = `55${d}`;
        return d;
    };
    const waHref = n => {
        const d = normalizarWa(n);
        return d ? `https://wa.me/${d}` : "#";
    };

    function agrupar() {
        const mapa = new Map();

        agendamentos.forEach(a => {
            const nome = String(a.nome || "Cliente").trim();
            const wa = String(a.whatsapp || "").replace(/\D/g,"");
            const chave = wa || nome.toLowerCase();

            if (!mapa.has(chave)) {
                mapa.set(chave, {
                    chave, nome, whatsapp: wa, agendamentos: [],
                    total: 0, compareceu: 0, faltou: 0, cancelado: 0, confirmado: 0
                });
            }

            const c = mapa.get(chave);
            c.agendamentos.push(a);
            c.total++;

            if (a.status === "compareceu") c.compareceu++;
            else if (a.status === "faltou") c.faltou++;
            else if (a.status === "cancelado") c.cancelado++;
            else if (a.status === "confirmado") c.confirmado++;

            if (!c.whatsapp && wa) c.whatsapp = wa;
            if ((!c.nome || c.nome === "Cliente") && nome) c.nome = nome;
        });

        clientes = [...mapa.values()].map(c => {
            c.agendamentos.sort((a,b) =>
                `${b.data || ""} ${b.horario || ""}`.localeCompare(`${a.data || ""} ${a.horario || ""}`)
            );

            const historicos = c.agendamentos.filter(a =>
                a.data && a.data <= hojeYmd() && a.status !== "cancelado"
            );
            const ultimo = historicos[0] || null;

            c.ultimo = ultimo;
            c.ultimoDias = ultimo ? diasDesde(ultimo.data) : Infinity;
            c.valorTotal = c.agendamentos.reduce((s,a) => s + (Number(a.valor) || 0), 0);

            return c;
        });

        clientes.sort((a,b) => {
            const da = a.ultimo?.data || "";
            const db = b.ultimo?.data || "";
            return db.localeCompare(da);
        });
    }

    function popularFiltros() {
        const servs = [...new Set(agendamentos.map(a => a.procedimento).filter(Boolean))].sort();

        const fs = document.getElementById("cliServ");
        if (fs) fs.innerHTML = `<option value="">Todos os serviços</option>` +
            servs.map(s => `<option value="${H(s)}">${H(s)}</option>`).join("");

        if (fs) fs.value = filtro.servico;
    }

    function filtrar() {
        const busca = filtro.busca.toLowerCase().trim();

        return clientes.filter(c => {
            const bateBusca = !busca ||
                c.nome.toLowerCase().includes(busca) ||
                c.whatsapp.includes(busca.replace(/\D/g,"")) ||
                c.whatsapp.includes(busca);

            const bateServ = !filtro.servico ||
                c.agendamentos.some(a => a.procedimento === filtro.servico);

            let batePeriodo = true;
            if (filtro.periodo === "7") batePeriodo = c.ultimoDias <= 7;
            if (filtro.periodo === "30") batePeriodo = c.ultimoDias <= 30;
            if (filtro.periodo === "90") batePeriodo = c.ultimoDias <= 90;
            if (filtro.periodo === "inativo") batePeriodo = c.ultimoDias > 30;
            if (filtro.periodo === "recente") batePeriodo = c.ultimoDias <= 30;

            return bateBusca && bateServ && batePeriodo;
        });
    }

    function statusHtml(c) {
        const arr = [];
        if (c.compareceu) arr.push(`<span class="cliente-status">${c.compareceu} compareceu</span>`);
        if (c.faltou) arr.push(`<span class="cliente-status">${c.faltou} faltou</span>`);
        if (c.cancelado) arr.push(`<span class="cliente-status">${c.cancelado} cancelado</span>`);
        if (c.confirmado) arr.push(`<span class="cliente-status">${c.confirmado} confirmado</span>`);
        return arr.join("");
    }

    function render() {
        const lista = filtrar();
        const tbody = document.getElementById("cliTabelaBody");
        const cards = document.getElementById("cliCards");
        const resumo = document.getElementById("cliResumo");

        if (resumo) resumo.textContent = `${lista.length} cliente(s) encontrado(s) de ${clientes.length}.`;

        const linhas = lista.map((c,i) => `
            <tr>
                <td><button type="button" class="cliente-nome-link" data-cliente="${H(c.chave)}">${H(c.nome)}</button></td>
                <td class="cliente-wa">${H(c.whatsapp || "—")}</td>
                <td>${c.total}</td>
                <td>${c.ultimo ? dataBR(c.ultimo.data) : "—"}</td>
                <td>${H(c.ultimo?.procedimento || "—")}</td>
                <td><div class="cliente-statuses">${statusHtml(c)}</div></td>
                <td class="cliente-valor">${c.valorTotal ? formatarMoeda(c.valorTotal) : "—"}</td>
                <td>
                    ${c.whatsapp ? `<a class="btn-cliente-wa" href="${waHref(c.whatsapp)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;padding:7px 10px;border-radius:5px;">WhatsApp</a>` : "—"}
                </td>
            </tr>
        `).join("");

        if (tbody) {
            tbody.innerHTML = linhas || `<tr><td colspan="8"><div class="clientes-vazio">Nenhum cliente encontrado.</div></td></tr>`;
        }

        if (cards) {
            cards.innerHTML = lista.map(c => `
                <article class="cliente-card">
                    <div class="cliente-card-top">
                        <div>
                            <div class="cliente-card-name">${H(c.nome)}</div>
                            <div class="cliente-card-meta">${H(c.whatsapp || "WhatsApp não cadastrado")}</div>
                        </div>
                        <strong>${c.total} agendamento${c.total === 1 ? "" : "s"}</strong>
                    </div>
                    <div class="cliente-card-grid">
                        <div><span>Último atendimento</span>${c.ultimo ? dataBR(c.ultimo.data) : "—"}</div>
                        <div><span>Último serviço</span>${H(c.ultimo?.procedimento || "—")}</div>
                        <div><span>Valor histórico</span>${c.valorTotal ? formatarMoeda(c.valorTotal) : "—"}</div>
                    </div>
                    <div class="cliente-statuses">${statusHtml(c)}</div>
                    <div class="cliente-card-actions" style="margin-top:12px">
                        <button type="button" data-cliente="${H(c.chave)}" class="cliente-ver">Ver histórico</button>
                        ${c.whatsapp ? `<a class="btn-cliente-wa" href="${waHref(c.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
                    </div>
                </article>
            `).join("") || `<div class="clientes-vazio">Nenhum cliente encontrado.</div>`;
        }
    }

    function abrirHistorico(chave) {
        const c = clientes.find(x => x.chave === chave);
        if (!c) return;

        const modal = document.getElementById("modalClienteHistorico");
        const titulo = document.getElementById("cliHistTitulo");
        const meta = document.getElementById("cliHistMeta");
        const lista = document.getElementById("cliHistLista");
        if (!modal || !titulo || !meta || !lista) return;

        titulo.textContent = c.nome;
        meta.innerHTML = `
            ${H(c.whatsapp || "WhatsApp não cadastrado")}
            ${c.whatsapp ? ` · <a href="${waHref(c.whatsapp)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : ""}
        `;

        lista.innerHTML = c.agendamentos.map(a => `
            <div class="cliente-historico-item">
                <div class="cliente-historico-data">
                    ${dataBR(a.data)}<br>${H(String(a.horario || "").slice(0,5))}
                </div>
                <div class="cliente-historico-main">
                    <strong>${H(a.procedimento || "Serviço não informado")}</strong>
                </div>
                <div class="cliente-historico-right">
                    <strong>${a.valor !== null && a.valor !== undefined ? formatarMoeda(a.valor) : "—"}</strong>
                    <span>${H(a.status || "—")}</span>
                </div>
            </div>
        `).join("") || `<div class="clientes-vazio">Nenhum agendamento no histórico.</div>`;

        modal.classList.add("aberto");
    }

    function montarPagina() {
        pag.innerHTML = `
            <header class="topbar">
                <div>
                    <h1>Clientes</h1>
                    <p>Clientes consolidados a partir dos agendamentos da MARGEM AUTO.</p>
                </div>
            </header>

            <section class="agenda clientes-page">
                <div class="clientes-toolbar">
                    <div class="cliente-busca">
                        <input id="cliBusca" type="search" placeholder="Pesquisar por nome ou WhatsApp">
                    </div>
                    <div class="cliente-filtro">
                        <select id="cliServ"></select>
                    </div>
                    <div class="cliente-filtro">
                        <select id="cliPeriodo">
                            <option value="">Todos os períodos</option>
                            <option value="7">Últimos 7 dias</option>
                            <option value="30">Últimos 30 dias</option>
                            <option value="90">Últimos 3 meses</option>
                            <option value="inativo">Sem agendar há mais de 30 dias</option>
                            <option value="recente">Clientes recentes</option>
                        </select>
                    </div>
                </div>

                <div id="cliResumo" class="clientes-resumo"></div>

                <div class="clientes-tabela-wrap">
                    <table class="clientes-tabela">
                        <thead>
                            <tr>
                                <th>Cliente</th><th>WhatsApp</th><th>Agendamentos</th>
                                <th>Último atendimento</th><th>Último serviço</th>
                                <th>Status</th><th>Valor</th><th></th>
                            </tr>
                        </thead>
                        <tbody id="cliTabelaBody"></tbody>
                    </table>
                </div>

                <div id="cliCards" class="clientes-cards"></div>
            </section>

            <div id="modalClienteHistorico" class="modal cliente-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h2 id="cliHistTitulo">Cliente</h2>
                            <p id="cliHistMeta" class="cliente-whatsapp-header"></p>
                        </div>
                        <button id="fecharClienteHistorico" class="fechar-modal" type="button">×</button>
                    </div>
                    <div id="cliHistLista" class="cliente-historico"></div>
                </div>
            </div>
        `;

        document.getElementById("cliBusca").addEventListener("input", e => {
            filtro.busca = e.target.value;
            render();
        });
        document.getElementById("cliServ").addEventListener("change", e => {
            filtro.servico = e.target.value;
            render();
        });
        document.getElementById("cliPeriodo").addEventListener("change", e => {
            filtro.periodo = e.target.value;
            render();
        });
        document.getElementById("fecharClienteHistorico").addEventListener("click", () =>
            document.getElementById("modalClienteHistorico").classList.remove("aberto")
        );

        pag.addEventListener("click", e => {
            const b = e.target.closest("[data-cliente]");
            if (b && (b.classList.contains("cliente-nome-link") || b.classList.contains("cliente-ver"))) {
                abrirHistorico(b.dataset.cliente);
            }
        });
    }

    window.carregarClientes = async function() {
        if (!document.getElementById("cliTabelaBody")) montarPagina();

        const { data, error } = await supabaseClient
            .from("agendamentos")
            .select("id,nome,whatsapp,procedimento,data,horario,status,valor")
            .order("data", { ascending: false })
            .order("horario", { ascending: false });

        if (error) {
            console.error("Erro ao carregar clientes:", error);
            const body = document.getElementById("cliTabelaBody");
            if (body) body.innerHTML = `<tr><td colspan="8"><div class="clientes-vazio">Não foi possível carregar os clientes. Verifique o RLS do banco.</div></td></tr>`;
            return;
        }

        agendamentos = data || [];
        agrupar();
        popularFiltros();
        render();
    };

    nav.addEventListener("click", e => {
        e.preventDefault();
        mostrarPagina("clientes");
    });
})();