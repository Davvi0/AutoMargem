// ============================================
// DASHBOARD | Visão geral
// Somente lê e analisa os dados existentes (agendamentos e despesas).
// ============================================
(() => {
    const $ = id => document.getElementById(id);
    const R = v => formatarMoeda(v), H = v => escaparHtml(v);
    const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const pag = $("paginaDashboard");
    const graficos = {};
    let cache = null, quando = 0, periodo = "mes";

    const iso = d => formatarData(d);
    const soma = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const br = d => d.split("-").reverse().join("/");
    const dt = s => new Date(s + "T00:00:00");
    // Mesmo WhatsApp = mesmo cliente (sem WhatsApp, usa o nome)
    const chave = x => (x.whatsapp || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") || (x.nome || "").trim().toLowerCase();

    // Faturamento: só depois que o dia e o horário passaram; nunca faltou/cancelado.
    // (mesma regra do Financeiro; definida aqui para o dashboard não depender de outro arquivo)
    function contaFat(x) {
        if (!x || x.valor === null || x.valor === undefined) return false;
        if (x.status === "cancelado" || x.status === "faltou") return false;
        const [ano, mes, dia] = String(x.data).slice(0, 10).split("-").map(Number);
        const [hora, min] = String(x.horario || "00:00").slice(0, 5).split(":").map(Number);
        if (!ano || !mes || !dia) return false;
        return new Date(ano, mes - 1, dia, hora || 0, min || 0, 0).getTime() <= Date.now();
    }

    // ---------- período atual e anterior equivalente ----------
    function limites() {
        const h = new Date(); h.setHours(0, 0, 0, 0);
        let i = h, f = h;
        if (periodo === "semana") { i = add(h, -((h.getDay() + 6) % 7)); f = add(i, 6); }
        else if (periodo === "mes") { i = new Date(h.getFullYear(), h.getMonth(), 1); f = new Date(h.getFullYear(), h.getMonth() + 1, 0); }
        else if (periodo === "custom") {
            i = dt($("dashIni").value || iso(h)); f = dt($("dashFim").value || iso(h));
            if (f < i) [i, f] = [f, i];
        }
        const n = Math.round((f - i) / 864e5) + 1;
        const dec = Math.max(1, Math.min(n, Math.round((h - i) / 864e5) + 1)); // dias já decorridos
        const ai = periodo === "mes" ? new Date(i.getFullYear(), i.getMonth() - 1, 1) : add(i, -n);
        const af = new Date(Math.min(add(ai, dec - 1), add(i, -1)));
        return { i: iso(i), f: iso(f), ai: iso(ai), af: iso(af), h: iso(h) };
    }

    // ---------- busca (2 consultas, com paginação) ----------
    async function todas(mk) {
        let out = [];
        for (let p = 0; ; p++) {
            const { data, error } = await mk().range(p * 1000, p * 1000 + 999);
            if (error) throw error;
            out = out.concat(data);
            if (data.length < 1000) return out;
        }
    }
    async function buscar() {
        const [ag, dp] = await Promise.all([
            todas(() => supabaseClient.from("agendamentos").select("nome,whatsapp,procedimento,data,horario,status,valor").order("data", { ascending: true })),
            todas(() => supabaseClient.from("despesas").select("valor,data").eq("user_id", usuarioAtual.id).order("data", { ascending: true }))
        ]);
        cache = { ag, dp }; quando = Date.now(); atual();
    }
    function atual() {
        const el = $("dashAtual"); if (!el || !quando) return;
        const m = Math.floor((Date.now() - quando) / 6e4);
        el.textContent = "Dados atualizados " + (m < 1 ? "agora há pouco" : `há ${m} min`);
    }

    // ---------- cálculos do período ----------
    function calc(ini, fim) {
        const a = cache.ag.filter(x => x.data >= ini && x.data <= fim);
        const fat = a.filter(contaFat); // mesma regra do Financeiro (só após passar data/hora; sem faltas e cancelados)
        const comp = a.filter(x => x.status === "compareceu");
        const dp = cache.dp.filter(x => x.data >= ini && x.data <= fim);
        const F = soma(fat, x => x.valor), atend = new Set(comp.map(chave)).size;
        const cont = s => a.filter(x => x.status === s).length;
        return { a, fat, comp, dp, F, D: soma(dp, x => x.valor), n: a.length, conf: cont("confirmado"), nc: comp.length, atend,
                 falt: cont("faltou"), canc: cont("cancelado"), ticket: atend ? F / atend : null };
    }

    // ---------- clientes (histórico inteiro, por WhatsApp) ----------
    function clientes(l) {
        const m = new Map(), fut = new Set();
        cache.ag.forEach(x => {
            const k = chave(x); if (!k) return;
            let c = m.get(k); if (!c) m.set(k, c = { nome: x.nome, att: [] });
            c.nome = x.nome || c.nome;
            if (x.status === "compareceu") c.att.push(x.data);
            if (x.status === "confirmado" && x.data > l.h) fut.add(k);
        });
        const r = { total: m.size, comp: 0, novos: 0, rec: 0, volt: 0, naoV: 0, d30: 0, d60: 0, d90: 0, top: [] };
        m.forEach((c, k) => {
            if (!c.att.length) return;
            r.comp++;
            const a = c.att.slice().sort(), dias = Math.round((dt(l.h) - dt(a[a.length - 1])) / 864e5);
            if (a.some(d => d >= l.i && d <= l.f)) a[0] >= l.i ? r.novos++ : r.rec++;
            if (a.length > 1) r.volt++;
            if (!fut.has(k) && dias >= 30) { r.d30++; if (a.length === 1) r.naoV++; if (dias >= 60) r.d60++; if (dias >= 90) r.d90++; }
            r.top.push({ nome: c.nome || "Cliente", q: a.length });
        });
        r.top = r.top.sort((x, y) => y.q - x.q).slice(0, 5);
        return r;
    }

    // ---------- componentes ----------
    const vazio = '<div class="dg-vazio">Sem dados no período</div>';
    const sec = (t, corpo, cls = "") => `<section class="dg-sec ${cls}"><h2>${t}</h2>${corpo}</section>`;
    const dl = (a, b) => (b > 0 && a != null) ? (a - b) / b * 100 : null;
    const delta = (d, inv) => d == null ? "" : Math.abs(d) < 0.05 ? '<span class="dg-d">Sem variação vs. período anterior</span>' :
        `<span class="dg-d ${(inv ? d <= 0 : d >= 0) ? "up" : "down"}">${d >= 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1).replace(".", ",")}% vs. período anterior</span>`;
    const card = (t, v, sub, d, inv) => `<div class="dg-card"><span>${t}</span><strong>${v}</strong><small>${sub || "&nbsp;"}</small>${delta(d, inv)}</div>`;
    // barras horizontais: itens { r: rótulo, v: valor, t: texto, d: destaque }
    function linhas(itens) {
        const mx = Math.max(0, ...itens.map(x => x.v));
        if (!itens.length || !mx) return vazio;
        return itens.map(x => `<div class="dg-lin${x.d ? " top" : ""}"><div class="dg-rt"><span>${H(x.r)}</span><b>${x.t}</b></div><div class="dg-bar"><i style="width:${Math.round(x.v / mx * 100)}%"></i></div></div>`).join("");
    }
    const stat = (t, v) => `<div class="dg-st"><b>${v}</b><span>${t}</span></div>`;

    function grafico(id, dias, series, linha, tip) {
        const W = 720, Hh = 230, pd = 34, base = Hh - pd, cw = (W - pd * 2) / dias.length;
        const mx = Math.max(1, ...series.flatMap(s => dias.map(d => s.v(d))));
        const y = v => base - v / mx * (Hh - pd * 2);
        let g = `<line class="dg-ax" x1="${pd}" x2="${W - pd}" y1="${base}" y2="${base}"/><text class="dg-tx" x="${pd}" y="14">${R(mx)}</text>`;
        series.forEach((s, k) => {
            if (linha) {
                const pts = dias.map((d, i) => `${pd + cw * (i + .5)},${y(s.v(d))}`);
                g += `<polygon class="dg-area" points="${pd + cw * .5},${base} ${pts.join(" ")} ${pd + cw * (dias.length - .5)},${base}"/><polyline class="dg-line" points="${pts.join(" ")}"/>`;
                if (dias.length <= 45) g += dias.map((d, i) => `<circle class="dg-dot" cx="${pd + cw * (i + .5)}" cy="${y(s.v(d))}" r="3"/>`).join("");
            } else {
                const bw = Math.max(2, cw * .7 / series.length);
                dias.forEach((d, i) => { const v = s.v(d); g += `<rect class="dg-b${k}" x="${pd + cw * (i + .15) + bw * k}" y="${y(v)}" width="${bw}" height="${base - y(v)}" rx="2"/>`; });
            }
        });
        const passo = Math.ceil(dias.length / 8);
        dias.forEach((d, i) => {
            if (i % passo === 0) g += `<text class="dg-tx" x="${pd + cw * (i + .5)}" y="${Hh - 10}" text-anchor="middle">${br(d).slice(0, 5)}</text>`;
            g += `<rect class="dg-hit" data-g="${id}" data-i="${i}" x="${pd + cw * i}" y="0" width="${cw}" height="${Hh}"/>`;
        });
        graficos[id] = { dias, tip };
        return `<div class="dg-chart"><svg viewBox="0 0 ${W} ${Hh}">${g}</svg><div class="dg-tip"></div></div>`;
    }

    // ---------- monta a página ----------
    function desenhar() {
        const l = limites(), c = calc(l.i, l.f), p = calc(l.ai, l.af), cli = clientes(l);
        const ativos = c.a.filter(x => x.status !== "cancelado");

        // série diária
        const dias = [];
        for (let d = dt(l.i); iso(d) <= l.f && dias.length < 366; d = add(d, 1)) dias.push(iso(d));
        const pd = {}; dias.forEach(d => pd[d] = { f: 0, a: 0, x: 0 });
        c.fat.forEach(x => { if (pd[x.data]) pd[x.data].f += Number(x.valor) || 0; });
        c.comp.forEach(x => { if (pd[x.data]) pd[x.data].a++; });
        c.dp.forEach(x => { if (pd[x.data]) pd[x.data].x += Number(x.valor) || 0; });

        // serviços (atendimentos realizados = status "compareceu")
        const sv = {};
        c.comp.forEach(x => { const k = x.procedimento || "Não informado"; sv[k] = sv[k] || { nome: k, q: 0, f: 0 }; sv[k].q++; sv[k].f += Number(x.valor) || 0; });
        const sl = Object.values(sv);
        const porQ = sl.slice().sort((a, b) => b.q - a.q || b.f - a.f).slice(0, 8);
        const porF = sl.filter(s => s.f > 0).sort((a, b) => b.f - a.f).slice(0, 8);

        // horários e dias da semana (agendamentos não cancelados)
        const hh = {}; for (let h = 8; h <= 18; h++) hh[String(h).padStart(2, "0") + ":00"] = 0;
        const sem = DIAS.map(() => 0);
        ativos.forEach(x => { const h = (x.horario || "").substring(0, 5); if (h) hh[h] = (hh[h] || 0) + 1; sem[(dt(x.data).getDay() + 6) % 7]++; });
        const hs = Object.keys(hh).sort(), hMax = Math.max(0, ...hs.map(h => hh[h])), sMax = Math.max(0, ...sem);
        const hTop = hMax ? hs.find(h => hh[h] === hMax) : null, sTop = sMax ? DIAS[sem.indexOf(sMax)] : null;

        // insights (só com dados reais)
        const ins = [];
        if (cli.d30) ins.push(`⚠️ ${cli.d30} cliente${cli.d30 > 1 ? "s estão" : " está"} há mais de 30 dias sem retornar.`);
        if (sTop && ativos.length >= 3) ins.push(`📈 ${sTop} foi o dia com maior movimento neste período.`);
        const dF = dl(c.F, p.F);
        if (dF != null && Math.abs(dF) >= 1) ins.push(`💰 O faturamento ${dF > 0 ? "aumentou" : "caiu"} ${Math.abs(dF).toFixed(1).replace(".", ",")}% em relação ao período anterior.`);
        if (hMax >= 2 && ativos.length >= 10) { const bx = hs.filter(h => h >= "08:00" && h <= "18:00").sort((a, b) => hh[a] - hh[b])[0]; if (hh[bx] <= hMax / 4) ins.push(`📅 O horário das ${bx} possui baixa ocupação.`); }
        if (porQ.length) ins.push(`✨ ${H(porQ[0].nome)} foi o procedimento mais realizado no período.`);
        if (c.falt) ins.push(`⚠️ A taxa de faltas está em ${pct(c.falt, c.n)}%.`);
        if (c.D > 0 && c.D > c.F) ins.push("💸 As despesas do período superam o faturamento.");

        const st = [["Compareceram", c.nc], ["Confirmados", c.conf], ["Faltaram", c.falt], ["Cancelados", c.canc]];
        const taxa = (cli.volt + cli.naoV) ? pct(cli.volt, cli.volt + cli.naoV) : null;
        const tipF = d => `<b>${br(d)}</b><br>Faturamento: ${R(pd[d].f)}<br>Atendimentos: ${pd[d].a}`;
        const tipE = d => `<b>${br(d)}</b><br>Entradas: ${R(pd[d].f)}<br>Despesas: ${R(pd[d].x)}`;

        $("dashCorpo").innerHTML =
            `<div class="dg-cards">` +
            card("Faturamento", R(c.F), "", dl(c.F, p.F)) +
            card("Agendamentos", c.n, `${c.conf} confirmados`, dl(c.n, p.n)) +
            card("Clientes atendidos", c.atend, `${c.nc} comparecimentos`, dl(c.atend, p.atend)) +
            card("Ticket médio", c.ticket == null ? "—" : R(c.ticket), "", dl(c.ticket, p.ticket)) +
            card("Faltas", c.falt, `${pct(c.falt, c.n)}% dos agendamentos`, dl(c.falt, p.falt), true) +
            card("Cancelamentos", c.canc, `${pct(c.canc, c.n)}% dos agendamentos`, dl(c.canc, p.canc), true) + `</div>` +
            sec("Insights", ins.length ? `<ul class="dg-ins">${ins.map(t => `<li>${t}</li>`).join("")}</ul>` : '<div class="dg-vazio">Ainda não há dados suficientes para gerar insights.</div>') +
            sec("Desempenho financeiro",
                `<div class="dg-fin">${stat("Faturamento", R(c.F))}${stat("Despesas", R(c.D))}${stat("Lucro", `<span class="${c.F - c.D < 0 ? "neg" : ""}">${R(c.F - c.D)}</span>`)}</div>` +
                `<p class="dg-leg"><i class="l0"></i>Entradas <i class="l1"></i>Despesas</p>` +
                grafico("g2", dias, [{ v: d => pd[d].f }, { v: d => pd[d].x }], false, tipE)) +
            sec("Faturamento ao longo do período", grafico("g1", dias, [{ v: d => pd[d].f }], true, tipF)) +
            `<div class="dg-2">` +
            sec("Serviços mais realizados", linhas(porQ.map((s, i) => ({ r: `${i + 1}. ${s.nome}`, v: s.q, t: `${s.q} atend.${s.f ? " · " + R(s.f) : ""}` })))) +
            sec("Serviços que mais geraram faturamento", linhas(porF.map((s, i) => ({ r: `${i + 1}. ${s.nome}`, v: s.f, t: `${R(s.f)} · ${s.q} atend.` })))) + `</div>` +
            `<div class="dg-2">` +
            sec("Desempenho dos agendamentos", linhas(st.map(([r, v]) => ({ r, v, t: `${v} · ${pct(v, c.n)}%` })))) +
            sec("Retenção de clientes",
                `<div class="dg-fin">${stat("Taxa de retorno", taxa == null ? "—" : taxa + "%")}${stat("Voltaram", cli.volt)}${stat("Não voltaram", cli.naoV)}${stat("Em risco (30+ dias)", cli.d30)}</div><p class="dg-nota">Taxa = clientes com 2+ atendimentos ÷ (esses + quem veio 1 vez e não voltou há 30+ dias).</p>`) + `</div>` +
            `<div class="dg-2">` +
            sec("Horários mais procurados", (hTop ? `<p class="dg-nota">Horário mais movimentado: <b>${hTop}</b></p>` : "") + linhas(hs.map(h => ({ r: h, v: hh[h], t: hh[h], d: h === hTop })))) +
            sec("Movimento por dia da semana", (sTop ? `<p class="dg-nota">Dia mais movimentado: <b>${sTop}</b></p>` : "") + linhas(DIAS.map((r, i) => ({ r, v: sem[i], t: sem[i], d: r === sTop })))) + `</div>` +
            `<div class="dg-2">` +
            sec("Clientes",
                `<div class="dg-fin">${stat("Cadastrados", cli.total)}${stat("Compareceram", cli.comp)}${stat("Novos no período", cli.novos)}${stat("Recorrentes no período", cli.rec)}${stat("30+ dias sem voltar", cli.d30)}</div>` +
                linhas([{ r: "Novos", v: cli.novos, t: cli.novos }, { r: "Recorrentes", v: cli.rec, t: cli.rec }])) +
            sec("Reativação",
                `<div class="dg-fin">${stat("30+ dias", cli.d30)}${stat("60+ dias", cli.d60)}${stat("90+ dias", cli.d90)}</div><button class="dg-btn" data-ir="reativacao">Ver clientes para reativar →</button>`) + `</div>` +
            sec("Clientes mais frequentes (histórico)", linhas(cli.top.map((t, i) => ({ r: `${i + 1}. ${t.nome}`, v: t.q, t: `${t.q} atendimento${t.q > 1 ? "s" : ""}` }))));
    }

    // ---------- carregar (com estados) ----------
    async function carregarDashboard(forcar) {
        const corpo = $("dashCorpo");
        if (forcar || !cache || Date.now() - quando > 60000) {
            corpo.innerHTML = '<div class="dg-vazio">Carregando...</div>';
            try { await buscar(); }
            catch (e) { console.error("Dashboard:", e); corpo.innerHTML = '<div class="dg-vazio">Erro ao carregar dados. <button class="dg-btn" id="dashRetry">Tentar novamente</button></div>'; return; }
        }
        try { desenhar(); }
        catch (e) { console.error("Dashboard:", e); corpo.innerHTML = '<div class="dg-vazio">Erro ao montar o dashboard.</div>'; }
    }
    window.carregarDashboard = carregarDashboard;

    // ---------- estrutura fixa + eventos ----------
    pag.innerHTML = `<header class="topbar"><div><h1>Visão geral</h1><p>Veja como está o desempenho da MARGEM AUTO.</p></div>
        <div class="dg-ctl"><div class="dg-seg">${[["hoje", "Hoje"], ["semana", "Esta semana"], ["mes", "Este mês"], ["custom", "Personalizado"]].map(([k, t]) => `<button data-p="${k}" class="${k === periodo ? "on" : ""}">${t}</button>`).join("")}</div>
        <div class="dg-custom" id="dashCustom" hidden><input type="date" id="dashIni"><input type="date" id="dashFim"></div>
        <button class="dg-btn" id="dashAtualizar">Atualizar dados</button><small id="dashAtual"></small></div></header><div id="dashCorpo"></div>`;

    pag.addEventListener("click", e => {
        const b = e.target.closest("[data-p]");
        if (b) {
            periodo = b.dataset.p;
            pag.querySelectorAll("[data-p]").forEach(x => x.classList.toggle("on", x === b));
            $("dashCustom").hidden = periodo !== "custom";
            if (periodo === "custom" && !$("dashIni").value) { const h = new Date(); $("dashIni").value = iso(new Date(h.getFullYear(), h.getMonth(), 1)); $("dashFim").value = iso(h); }
            if (cache) desenhar();
        }
        if (e.target.closest("#dashAtualizar, #dashRetry")) carregarDashboard(true);
        if (e.target.closest("[data-ir]")) mostrarPagina("reativacao");
    });
    pag.addEventListener("change", e => { if (e.target.matches("#dashIni, #dashFim") && cache) desenhar(); });
    pag.addEventListener("pointermove", e => {
        pag.querySelectorAll(".dg-tip").forEach(t => t.style.display = "none");
        const r = e.target.closest && e.target.closest("[data-g]"); if (!r) return;
        const w = r.closest(".dg-chart"), t = w.querySelector(".dg-tip"), g = graficos[r.dataset.g], bx = w.getBoundingClientRect();
        t.innerHTML = g.tip(g.dias[r.dataset.i]);
        t.style.display = "block";
        t.style.left = Math.max(0, Math.min(e.clientX - bx.left + 14, bx.width - 190)) + "px";
    });
    pag.addEventListener("pointerleave", () => pag.querySelectorAll(".dg-tip").forEach(t => t.style.display = "none"));
    $("navDashboard").addEventListener("click", e => { e.preventDefault(); mostrarPagina("dashboard"); });
    setInterval(atual, 30000);
})();