// ============================================================
// MARGEM AUTO — interface da landing e do agendamento
// A lógica de agendamento (Supabase, horários ocupados, validação,
// confirmação, WhatsApp) continua toda em agendamento.js.
// Este arquivo só monta a interface e sincroniza os campos originais.
// ============================================================
(() => {
    "use strict";

    const CONFIG = window.STUDIO_CONFIG;

    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // ------------------------------------------------------------
    // CONTATO / FOOTER
    // ------------------------------------------------------------
    $("#cEnd").textContent = $("#fEnd").textContent = CONFIG.endereco;
    $("#cHor").textContent = $("#fHor").textContent = CONFIG.horario;
    $("#lWa").href = $("#fWa").href = `https://wa.me/${CONFIG.whatsapp}`;
    $("#lIg").href = $("#fIg").href = CONFIG.instagram;
    $("#lMp").href = CONFIG.maps;
    $("#yr").textContent = new Date().getFullYear();

    // ------------------------------------------------------------
    // SERVIÇOS (lista na página, cards do agendamento e <select> original)
    // ------------------------------------------------------------
    const pad = n => String(n + 1).padStart(2, "0");
    // Lista da seção "Serviços". `entrada` = true na 1ª vez (anima ao rolar);
    // ao atualizar com os dados do banco os itens já entram visíveis.
    function desenharListaServicos(lista, entrada) {
        const ul = $("#svcList");
        ul.innerHTML = lista.map((s, i) => `
        <li class="rv${entrada ? "" : " in"}">
            <div class="svc-row">
                <span class="svc-n">${pad(i)}</span>
                <h3 class="svc-name">${esc(s.nome)}</h3>
                <p class="svc-desc">${esc(s.desc || "")}</p>
                ${s.precoLista ? `<span class="svc-price">${esc(s.precoLista)}</span>` : ""}
                <button type="button" class="svc-go" data-open data-proc="${esc(s.nome)}">Agendar</button>
            </div>
        </li>`).join("");
        // sem preço: a linha usa uma coluna a menos
        ul.classList.toggle("sem-preco", lista.every(s => !s.precoLista));
    }
    desenharListaServicos(CONFIG.servicos.map(s => ({ ...s, precoLista: s.preco })), true);

    const selProc = $("#procedimento");
    let catalogoServicos = [...CONFIG.servicos];
    let servicosDisponiveis = [...catalogoServicos];

    function servicoInfo(nome) {
        const base = catalogoServicos.find(s => s.nome === nome);
        return base || { nome, desc: "", preco: "" };
    }

    function desenharServicosOpcoes(lista) {
        const servicoSelecionado = selProc.value;

        servicosDisponiveis = lista || [];

        selProc.innerHTML = "";
        selProc.add(new Option("Selecione", ""));

        servicosDisponiveis.forEach(s => {
            selProc.add(new Option(s.nome, s.nome));
        });

        // O preço NÃO aparece aqui de propósito: o cliente só vê o valor no
        // passo final (resumo) e na confirmação.
        $("#optServ").innerHTML = servicosDisponiveis.map(s => `
            <button
                type="button"
                class="opt"
                role="radio"
                aria-checked="${s.nome === servicoSelecionado}"
                data-v="${esc(s.nome)}"
            >
                <span>
                    <strong>${esc(s.nome)}</strong>
                    <small>${esc(s.desc || "")}</small>
                </span>
            </button>
        `).join("");

        // Mantém o serviço que o cliente já havia escolhido
        if (
            servicoSelecionado &&
            servicosDisponiveis.some(
                s => s.nome.trim().toLowerCase() === servicoSelecionado.trim().toLowerCase()
            )
        ) {
            selProc.value = servicoSelecionado;
        } else {
            selProc.value = "";
        }

        marcaServico();
    }

// ------------------------------------------------------------
// SERVIÇOS DINÂMICOS DO BANCO
// ------------------------------------------------------------
// Os serviços cadastrados em:
// ADMIN > PREÇOS
// passam automaticamente a aparecer no agendamento público.
//
// CONFIG.servicos continua sendo usado como fallback caso
// o banco ainda não tenha serviços cadastrados.
// ------------------------------------------------------------

async function carregarServicosDoBanco() {
    if (typeof supabaseClient === "undefined") return;

    try {
        const { data, error } = await supabaseClient.rpc("servicos_catalogo");

        if (error) {
            console.error("Erro ao carregar serviços do banco:", error);
            return;
        }

        if (!Array.isArray(data)) return;

        const vistos = new Set();

        const novosServicos = data
            .map(item => {
                const nome = String(item.servico || "").trim();
                const existente = catalogoServicos.find(
                    servico =>
                        String(servico.nome || "").trim().toLowerCase() ===
                        nome.toLowerCase()
                );

                const preco =
                    item.preco === null || item.preco === undefined
                        ? ""
                        : formatarMoeda(item.preco);

                const config = CONFIG.servicos.find(
                    servico =>
                        String(servico.nome || "").trim().toLowerCase() ===
                        nome.toLowerCase()
                );

                const descBanco = String(item.descricao || "").trim();

                return {
                    ...(existente || { nome, desc: "" }),
                    nome,
                    preco,
                    // descrição do painel; se vazia, usa a do config-site.js
                    desc: descBanco || (config && config.desc) || "",
                    // a lista da seção Serviços só mostra preço se estiver no config
                    precoLista: config ? config.preco : ""
                };
            })
            .filter(servico => servico.nome)
            .filter(servico => {
                const chave = servico.nome.trim().toLowerCase();

                if (vistos.has(chave)) return false;

                vistos.add(chave);
                return true;
            });

        if (novosServicos.length) {
            catalogoServicos = novosServicos;
            desenharServicosOpcoes(catalogoServicos);
            desenharListaServicos(novosServicos, false);
        }

    } catch (erro) {
        console.error("Erro inesperado ao carregar serviços:", erro);
    }
}

// Primeiro mostra os serviços padrão.
// Depois atualiza com os serviços cadastrados pelo administrador.
desenharServicosOpcoes(catalogoServicos);
carregarServicosDoBanco();
    // faixa em movimento (duplicada para loop contínuo)
    // opcional: a faixa pode ser removida da landing sem quebrar a renderização do restante do site.
    const strip = document.querySelector("#strip");
    if (strip) {
        const palavras = [...CONFIG.servicos.map(s => s.nome), "Estilo", "Precisão"];
        const faixa = palavras.map(p => `<span>${esc(p)}</span>`).join("");
        strip.innerHTML = faixa + faixa + faixa + faixa;
    }

    // ------------------------------------------------------------
    // IMAGENS REAIS (usa se existir; senão mantém o espaço reservado)
    // ------------------------------------------------------------
    const src = nome => {
        if (!nome) return "";
        if (/^(https?:)?\/\//i.test(nome) || nome.startsWith("data:") || nome.startsWith("./") || nome.startsWith("../") || nome.startsWith("/")) {
            return nome;
        }
        return `../assets/${nome}`;
    };
    const IMG = CONFIG.imagens;

    // hero
    if (IMG.hero) {
        const h = $("#heroImg");
        h.style.backgroundImage = `url('${src(IMG.hero)}')`;
        h.classList.add("on");
    }

    // sobre
    $$("[data-img]").forEach((fig, i) => {
        const nome = IMG.sobre[i];
        if (!nome) return;
        fig.classList.add("has");
        fig.innerHTML = `<img src="${src(nome)}" alt="MARGEM AUTO" loading="lazy">`;
    });

    // galeria
    const galUrls = [];
    const galGrid = $("#galGrid");
    galGrid.innerHTML = Array.from({ length: CONFIG.galeriaQtd }, (_, i) => `<div class="gt ph rv" data-i="${i}"></div>`).join("");
    $$("#galGrid .gt").forEach((el, i) => {
        const nome = IMG.galeria[i];
        if (!nome) return;
        el.classList.add("has");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `Ampliar foto ${i + 1}`);
        el.innerHTML = `<img src="${src(nome)}" alt="Foto ${i + 1} do MARGEM AUTO" loading="lazy">`;
        galUrls[i] = src(nome);
    });

    // lightbox
    const lb = $("#lb"), lbImg = $("#lbImg");
    let lbIdx = 0;
    const lista = () => galUrls.map((u, i) => u ? i : -1).filter(i => i >= 0);
    function abrirLb(i) {
        lbIdx = i; lbImg.src = galUrls[i];
        lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
    function fecharLb() {
        lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true");
        if (!dw.classList.contains("open")) document.body.style.overflow = "";
    }
    function moverLb(d) {
        const l = lista(); if (!l.length) return;
        const pos = (l.indexOf(lbIdx) + d + l.length) % l.length;
        lbIdx = l[pos]; lbImg.src = galUrls[lbIdx];
    }
    galGrid.addEventListener("click", e => {
        const t = e.target.closest(".gt.has"); if (t) abrirLb(+t.dataset.i);
    });
    galGrid.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("has")) { e.preventDefault(); abrirLb(+e.target.dataset.i); }
    });
    lb.addEventListener("click", e => {
        if (e.target.closest("[data-lb-close]") || e.target === lb) fecharLb();
        const n = e.target.closest("[data-lb]"); if (n) moverLb(+n.dataset.lb);
    });

    // ------------------------------------------------------------
    // HEADER, MENU MOBILE, PARALLAX SUTIL, CTA FIXO
    // ------------------------------------------------------------
    const hd = $("#hd"), nav = $("#nav"), burger = $("#burger"), fab = $("#fab"), hero = $("#inicio");
    function toggleMenu(open) {
        nav.classList.toggle("open", open);
        hd.classList.toggle("menu", open);
        burger.setAttribute("aria-expanded", open);
        burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
        document.body.style.overflow = open ? "hidden" : "";
    }
    burger.addEventListener("click", () => toggleMenu(!nav.classList.contains("open")));
    nav.addEventListener("click", e => { if (e.target.closest("a, button")) toggleMenu(false); });

    const par = $$("[data-p]");
    let tick = false;
    function frame() {
        tick = false;
        const y = scrollY;
        hd.classList.toggle("on", y > 40);
        fab.classList.toggle("on", y > hero.offsetHeight * .6);
        if (!reduce && y < innerHeight * 1.2) par.forEach(el => { el.style.transform = `translate3d(${el.classList.contains("hero-ghost") ? "-50%" : "0"},${y * el.dataset.p}px,0)`; });
    }
    addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(frame); } }, { passive: true });
    addEventListener("resize", frame);
    frame();

    // reveal
    const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: .12, rootMargin: "0px 0px -40px 0px" });
    $$(".rv").forEach(el => io.observe(el));

    // ------------------------------------------------------------
    // AGENDAMENTO EM ETAPAS
    // Os campos originais (#procedimento, #data, #horario, #nome,
    // #whatsapp) continuam sendo a fonte da verdade para agendamento.js.
    // ------------------------------------------------------------
    const dw = $("#dw"), form = $("#formAgendamento");
    const campoData = $("#data"), selHor = $("#horario");
    const campoNome = $("#nome"), campoWa = $("#whatsapp");
    const stepErr = $("#stepErr");
    const TOTAL = 5;
    let step = 1, lastFocus = null;

    const dispara = (el, tipo = "change") => el.dispatchEvent(new Event(tipo, { bubbles: true }));
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dataBR = v => { const [a, m, d] = v.split("-"); return `${d}/${m}/${a}`; };

    function irPara(n) {
        step = Math.max(1, Math.min(TOTAL, n));
        $$(".step").forEach(s => s.classList.toggle("on", +s.dataset.step === step));
        $$("#prog li").forEach(li => li.classList.toggle("on", +li.dataset.s <= step));
        $("#progBar").style.width = `${step / TOTAL * 100}%`;
        dw.dataset.step = step;
        stepErr.textContent = "";
        if (step === 5) resumo();
        $(".dw-p").scrollTo({ top: 0 });
        if (step === 4) setTimeout(() => campoNome.focus({ preventScroll: true }), 350);
    }

    // --- passo 1: serviço
    function marcaServico() {
        $$("#optServ .opt").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === selProc.value)));
    }
    $("#optServ").addEventListener("click", e => {
        const b = e.target.closest(".opt"); if (!b) return;
        selProc.value = b.dataset.v; dispara(selProc); marcaServico();
        setTimeout(() => irPara(2), 180);
    });

    // --- passo 2: data (faixa de dias + campo nativo)
    const dias = $("#optDias");
    const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    function montaDias() {
        const base = new Date();
        dias.innerHTML = Array.from({ length: CONFIG.diasNaFaixa }, (_, i) => {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
            const rot = i === 0 ? "hoje" : i === 1 ? "amanhã" : SEM[d.getDay()];
            return `<button type="button" class="day" role="radio" aria-checked="false" data-v="${ymd(d)}"><span>${rot}</span><b>${d.getDate()}</b><span>${MES[d.getMonth()]}</span></button>`;
        }).join("");
    }
    function marcaData() {
        let achou = false;
        $$("#optDias .day").forEach(b => { const on = b.dataset.v === campoData.value; achou ||= on; b.setAttribute("aria-checked", String(on)); });
    }
    function setData(v) {
        campoData.value = v; dispara(campoData); marcaData();
        selHor.value = ""; marcaHorarios();
    }
    dias.addEventListener("click", e => {
        const b = e.target.closest(".day"); if (!b) return;
        setData(b.dataset.v);
        setTimeout(() => irPara(3), 180);
    });
    // campo nativo: o próprio navegador dispara "change", que agendamento.js já escuta
    campoData.addEventListener("change", () => {
        marcaData();
        if (campoData.value && step === 2) setTimeout(() => irPara(3), 180);
    });

    // --- passo 3: horários espelhando o <select> original
    const optHor = $("#optHor"), horHint = $("#horHint");
    function desenhaHorarios() {
        const ops = [...selHor.options];
        const reais = ops.filter(o => o.value);
        optHor.classList.remove("load");
        if (!campoData.value) { optHor.innerHTML = ""; horHint.textContent = "Escolha uma data primeiro."; return; }
        if (!reais.length) {
            const txt = (ops[0]?.textContent || "").trim();
            if (/carregando/i.test(txt)) {
                horHint.textContent = "Buscando horários disponíveis…";
                optHor.classList.add("load");
                optHor.innerHTML = Array.from({ length: 8 }, () => `<div class="time-sk"></div>`).join("");
            } else {
                horHint.textContent = /erro/i.test(txt) ? "Não foi possível carregar os horários. Volte e escolha a data novamente." : "";
                optHor.innerHTML = "";
            }
            return;
        }
        const livres = reais.filter(o => !o.disabled).length;
        horHint.textContent = livres ? `${dataBR(campoData.value)} · ${livres} horário${livres > 1 ? "s" : ""} ${livres > 1 ? "disponíveis" : "disponível"}` : "Sem horários livres neste dia. Volte e escolha outra data.";
        optHor.innerHTML = reais.map(o => `<button type="button" class="time" role="radio" aria-checked="${o.value === selHor.value}" data-v="${o.value}" ${o.disabled ? "disabled" : ""}>${o.value}</button>`).join("");
    }
    function marcaHorarios() {
        $$("#optHor .time").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === selHor.value)));
    }
    // agendamento.js reescreve as opções do select a cada carga: espelhamos
    new MutationObserver(() => {
        desenhaHorarios();
        aplicaHorarioPendente();
        // horário foi invalidado (ex.: ocupado agora): volta para a escolha
        if (!selHor.value && step > 3) { irPara(3); }
    }).observe(selHor, { childList: true });
    optHor.addEventListener("click", e => {
        const b = e.target.closest(".time"); if (!b || b.disabled) return;
        selHor.value = b.dataset.v; dispara(selHor); marcaHorarios();
        setTimeout(() => irPara(4), 180);
    });

    // --- passo 5: resumo
    async function resumo() {
        $("#sumServ").textContent = selProc.value || "-";
        $("#sumData").textContent = campoData.value ? dataBR(campoData.value) : "-";
        $("#sumHor").textContent = selHor.value || "-";
        $("#sumNome").textContent = campoNome.value.trim() || "-";
        $("#sumWa").textContent = campoWa.value || "-";

        const valorEl = $("#sumValor");
        if (!valorEl) return;

        valorEl.textContent = "Calculando…";
        const valor = typeof window.obterPrecoServico === "function"
            ? await window.obterPrecoServico(selProc.value)
            : null;

        valorEl.textContent = valor === null ? "—" : formatarMoeda(valor);
    }

    // --- validação por etapa
    function valida() {
        if (step === 1 && !selProc.value) return "Escolha um serviço para continuar.";
        if (step === 2 && !campoData.value) return "Escolha uma data para continuar.";
        if (step === 3 && !selHor.value) return "Escolha um horário disponível.";
        if (step === 4) {
            if (!campoNome.value.trim()) return "Informe seu nome.";
            const dig = campoWa.value.replace(/\D/g, "");
            if (dig.length < 10 || dig.length > 13) return "Informe um WhatsApp válido, com DDD.";
        }
        return "";
    }
    function proximo() {
        $("#mensagem").textContent = "";
        const erro = valida();
        if (erro) { stepErr.textContent = erro; return; }
        irPara(step + 1);
    }
    $("#btnProx").addEventListener("click", proximo);
    $("#btnVoltar").addEventListener("click", () => { $("#mensagem").textContent = ""; irPara(step - 1); });

    // Enter nos campos não pode confirmar antes da revisão: avança a etapa.
    // (captura no document: roda antes do submit tratado em agendamento.js)
    document.addEventListener("submit", e => {
        if (e.target !== form || step >= TOTAL) return;
        e.preventDefault(); e.stopImmediatePropagation();
        proximo();
    }, true);
    // erro do agendamento.js (ex.: "Esse horário acabou de ser ocupado") fica visível no passo
    $("#progBar").parentNode.parentNode.insertAdjacentElement("afterend", $("#mensagem"));

    // reiniciar após confirmação
    function reiniciar() {
        selProc.value = ""; campoData.value = ""; selHor.value = "";
        desenharServicosOpcoes(catalogoServicos);
        marcaServico(); marcaData(); desenhaHorarios();
        irPara(1);
    }
    $("#novoAgendamento").addEventListener("click", reiniciar);

    // ------------------------------------------------------------
    // ABRIR / FECHAR O DRAWER
    // ------------------------------------------------------------
    // Cliente logado: preenche nome e WhatsApp (só se os campos estiverem vazios)
    async function preencherCliente() {
        try {
            if (typeof supabaseClient === "undefined" || campoNome.value || campoWa.value) return;
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return;
            const { data } = await supabaseClient.from("clientes").select("nome, whatsapp").eq("user_id", session.user.id).maybeSingle();
            if (!data || campoNome.value || campoWa.value) return;
            campoNome.value = data.nome;
            campoWa.value = data.whatsapp;
            dispara(campoWa, "input");      // aplica a máscara de agendamento.js
        } catch (e) { /* sem login ou tabela ausente: segue como visitante */ }
    }

    function abrir(proc) {
        preencherCliente();
        lastFocus = document.activeElement;
        if ($("#confirmacao").style.display === "block") $("#novoAgendamento").click();
        montaDias(); marcaData();
        campoData.min = ymd(new Date());
        if (proc && CONFIG.servicos.some(s => s.nome === proc)) {
            selProc.value = proc; dispara(selProc); marcaServico();
        }
        irPara(!selProc.value ? 1 : !campoData.value ? 2 : 3);
        dw.classList.add("open"); dw.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setTimeout(() => $(".dw-x").focus({ preventScroll: true }), 450);
    }
    function fechar() {
        dw.classList.remove("open"); dw.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    document.addEventListener("click", e => {
        const o = e.target.closest("[data-open]");
        if (o) { const p = o.dataset.proc || (o.closest("[data-proc]") || {}).dataset?.proc; abrir(p || null); }
        if (e.target.closest("[data-close]")) fechar();
    });
    addEventListener("keydown", e => {
        if (e.key === "Escape") {
            if (lb.classList.contains("open")) fecharLb();
            else if (dw.classList.contains("open")) fechar();
            else if (nav.classList.contains("open")) toggleMenu(false);
        }
        if (lb.classList.contains("open")) {
            if (e.key === "ArrowRight") moverLb(1);
            if (e.key === "ArrowLeft") moverLb(-1);
        }
    });

    // ------------------------------------------------------------
    // VOLTA DO E-MAIL DE CONFIRMAÇÃO
    // Se a pessoa criou a conta no meio do agendamento e confirmou o e-mail
    // em outra aba, restauramos o que ela tinha escolhido (guardado por
    // agendamento.js) e seguimos para os dados / confirmação.
    // ------------------------------------------------------------
    const veioDoEmail = /access_token=|[?&]code=/.test(location.hash + location.search);
    let horPendente = null;

    function aplicaHorarioPendente() {
        if (!horPendente) return;
        const reais = [...selHor.options].filter(o => o.value);
        if (!reais.length) return;                       // ainda carregando
        const alvo = reais.find(o => o.value === horPendente && !o.disabled);
        horPendente = null;
        if (alvo) { selHor.value = alvo.value; dispara(selHor); marcaHorarios(); irPara(4); }
        else irPara(3);                                  // horário não está mais livre
    }

    function restaurarRascunho() {
        if (!veioDoEmail || dw.classList.contains("open")) return;
        let r = null;
        try { r = JSON.parse(localStorage.getItem("studio_rascunho_agendamento") || "null"); } catch (e) { }
        if (!r || Date.now() - r.ts > 3600 * 1000) return;
        try { localStorage.removeItem("studio_rascunho_agendamento"); } catch (e) { }
        abrir(r.procedimento || null);
        if (r.data && r.data >= ymd(new Date())) {
            horPendente = r.horario || null;
            setData(r.data);
            irPara(3);
        }
    }

    if (veioDoEmail && typeof supabaseClient !== "undefined") {
        supabaseClient.auth.onAuthStateChange(ev => {
            if (ev === "SIGNED_IN" || ev === "INITIAL_SESSION") setTimeout(restaurarRascunho, 0);
        });
    }

    montaDias();
    irPara(1);

    // vindo da Área do cliente (cliente.html -> index.html#agendar)
    if (location.hash === "#agendar") {
        history.replaceState(null, "", location.pathname + location.search);
        abrir(null);
    }
})();