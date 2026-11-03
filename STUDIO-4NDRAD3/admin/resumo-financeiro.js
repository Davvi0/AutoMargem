// ============================================================
// MARGEM AUTO — cálculo financeiro (puro, sem acesso ao banco)
//
//  Receita agendada  = valor dos agendamentos que ainda contam (não cancelados e sem falta),
//                      pagos ou não, já realizados ou futuros.
//  Recebido          = parte da receita agendada marcada como paga (pago = true).
//  A receber         = agendada - recebido.
//  Lucro             = recebido - despesas   (dinheiro que de fato entrou menos o que saiu).
//  Resultado previsto= agendada - despesas   (se tudo que está agendado for pago).
// ============================================================
(function (g) {
    const EXCLUIDOS = ["cancelado", "faltou"];

    const numero = v => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    function ehReceitaAgendada(a) {
        if (!a || a.valor === null || a.valor === undefined) return false;
        const st = String(a.status || "").trim().toLowerCase();
        return !EXCLUIDOS.includes(st);
    }

    function ehRecebido(a) {
        return ehReceitaAgendada(a) && a.pago === true;
    }

    function centavos(v) { return Math.round(v * 100) / 100; }

    function calcularResumoFinanceiro(agendamentos, despesas) {
        let agendada = 0, recebida = 0;
        (agendamentos || []).forEach(a => {
            if (!ehReceitaAgendada(a)) return;
            const v = numero(a.valor);
            agendada += v;
            if (a.pago === true) recebida += v;
        });
        const totalDespesas = (despesas || []).reduce((s, d) => s + numero(d && d.valor), 0);
        return {
            agendada: centavos(agendada),
            recebida: centavos(recebida),
            aReceber: centavos(agendada - recebida),
            despesas: centavos(totalDespesas),
            lucro: centavos(recebida - totalDespesas),
            resultadoPrevisto: centavos(agendada - totalDespesas)
        };
    }

    const api = { calcularResumoFinanceiro, ehReceitaAgendada, ehRecebido };
    g.MargemFinanceiro = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
