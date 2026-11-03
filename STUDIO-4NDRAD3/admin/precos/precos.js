// ============================================
// ABA PREÇOS
// Um preço por serviço (tabela servicos_precos).
// Alterar um preço afeta só os novos agendamentos:
// o valor já gravado em cada agendamento é histórico.
// ============================================
(() => {
    const $ = id => document.getElementById(id);
    const pag = $("paginaPrecos");

    if (!pag) return;

    const H = v => escaparHtml(v);

    let linhas = [];
    // { nome, preco: number|null, disponivel: boolean, descricao: string }

    const dl = $("servicosLista");

    if (dl && typeof SERVICOS !== "undefined") {
        dl.innerHTML = SERVICOS
            .map(n => `<option value="${H(n)}"></option>`)
            .join("");
    }

    pag.innerHTML = `
        <header class="topbar">
            <div>
                <h1>Preços</h1>
                <p>Defina o preço e a disponibilidade de cada serviço.</p>
            </div>
        </header>

        <section class="agenda precos-v2">

            <div class="agenda-title">
                <div>
                    <h2>Tabela de preços</h2>
                    <span id="prAviso"></span>
                </div>
            </div>

            <div class="precos-legenda">
                <span>✓ disponível para agendamento</span>
                <span>Serviço sem preço não aparece para o cliente</span>
            </div>

            <div class="precos-scroll">
                <table class="tabela-precos tabela-precos-simples">

                    <thead>
                        <tr>
                            <th>Serviço</th>
                            <th>Descrição (aparece no site)</th>
                            <th>Disponível</th>
                            <th>Preço</th>
                            <th></th>
                        </tr>
                    </thead>

                    <tbody id="prLista"></tbody>

                </table>
            </div>

            <div class="precos-novo">

                <input
                    type="text"
                    id="prNovoNome"
                    placeholder="Novo serviço (ex.: Vitrificação de faróis)"
                >

                <button
                    type="button"
                    id="prAdd"
                    class="btn-agendar"
                >
                    + Adicionar serviço
                </button>

            </div>

            <div class="precos-acoes">

                <button
                    type="button"
                    id="prSalvar"
                    class="btn-agendar"
                >
                    Salvar alterações
                </button>

                <button
                    type="button"
                    id="prAplicar"
                    class="btn-agendar"
                >
                    Preencher atendimentos antigos sem valor
                </button>

            </div>

            <p class="info precos-info">
                Alterar um preço aqui afeta apenas novos agendamentos.
                O valor já salvo em um agendamento permanece como histórico.
                Desmarcar "Disponível" tira o serviço do agendamento para novos clientes.
            </p>

        </section>
    `;

    const aviso = t => {
        $("prAviso").textContent = t || "";
    };

    const igual = (a, b) =>
        String(a || "").trim().toLowerCase() ===
        String(b || "").trim().toLowerCase();


    // ============================================
    // MONTAR LINHAS (serviços do código + os do banco)
    // ============================================

    function montarLinhas(dados) {

        const nomes = [
            ...(typeof SERVICOS !== "undefined" ? SERVICOS : [])
        ];

        (dados || []).forEach(r => {

            const nome = String(r.nome || "").trim();

            if (nome && !nomes.some(n => igual(n, nome))) {
                nomes.push(nome);
            }

        });

        return nomes
            .filter(Boolean)
            .map(nome => {

                const item = (dados || []).find(r => igual(r.nome, nome));

                return {
                    nome,
                    preco:
                        item && item.preco !== null && item.preco !== undefined
                            ? Number(item.preco)
                            : null,
                    disponivel: item ? item.disponivel !== false : true,
                    descricao: item ? String(item.descricao || "") : ""
                };

            });

    }


    // ============================================
    // DESENHAR TABELA
    // ============================================

    function desenhar() {

        const tbody = $("prLista");

        tbody.innerHTML = linhas
            .map((linha, i) => `
                <tr>

                    <td class="preco-servico-nome">
                        <strong>${H(linha.nome)}</strong>
                    </td>

                    <td class="preco-descricao">
                        <textarea
                            rows="2"
                            maxlength="400"
                            data-i="${i}"
                            data-field="descricao"
                            placeholder="Texto que o cliente vê na seção de serviços"
                        >${H(linha.descricao || "")}</textarea>
                    </td>

                    <td>
                        <label class="preco-disponivel">
                            <input
                                type="checkbox"
                                data-i="${i}"
                                data-field="disponivel"
                                ${linha.disponivel ? "checked" : ""}
                            >
                            <span>Disponível</span>
                        </label>
                    </td>

                    <td>
                        <div class="preco-input-wrap">
                            <span>R$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputmode="decimal"
                                data-i="${i}"
                                data-field="preco"
                                value="${linha.preco ?? ""}"
                                placeholder="0,00"
                                ${linha.disponivel ? "" : "disabled"}
                            >
                        </div>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="pr-excluir"
                            data-i="${i}"
                        >
                            Excluir
                        </button>
                    </td>

                </tr>
            `)
            .join("")
            ||
            `
                <tr>
                    <td colspan="5">Nenhum serviço ainda.</td>
                </tr>
            `;


        // Alterar preço
        tbody
            .querySelectorAll('[data-field="preco"]')
            .forEach(input => {

                input.addEventListener("input", () => {

                    const i = Number(input.dataset.i);

                    const v =
                        input.value === ""
                            ? null
                            : parseFloat(input.value);

                    linhas[i].preco = Number.isNaN(v) ? null : v;

                });

            });


        // Alterar descrição
        tbody
            .querySelectorAll('[data-field="descricao"]')
            .forEach(input => {

                input.addEventListener("input", () => {

                    linhas[Number(input.dataset.i)].descricao = input.value;

                });

            });


        // Alterar disponibilidade
        tbody
            .querySelectorAll('[data-field="disponivel"]')
            .forEach(input => {

                input.addEventListener("change", () => {

                    const i = Number(input.dataset.i);

                    linhas[i].disponivel = input.checked;

                    const preco =
                        tbody.querySelector(
                            `[data-field="preco"][data-i="${i}"]`
                        );

                    if (preco) preco.disabled = !input.checked;

                });

            });


        // Excluir serviço
        tbody
            .querySelectorAll(".pr-excluir")
            .forEach(button => {

                button.addEventListener("click", async () => {

                    const i = Number(button.dataset.i);
                    const linha = linhas[i];

                    if (!linha) return;

                    const nome = linha.nome;

                    const confirmar = confirm(
                        `Excluir o serviço "${nome}"?\n\n` +
                        `Ele sai da tabela de preços e do agendamento.\n\n` +
                        `Agendamentos antigos não serão alterados.`
                    );

                    if (!confirmar) return;

                    button.disabled = true;

                    aviso(`Excluindo "${nome}"…`);

                    try {

                        const { error } =
                            await supabaseClient
                                .from("servicos_precos")
                                .delete()
                                .ilike("nome", nome);

                        if (error) {

                            console.error("Erro ao excluir serviço:", error);

                            aviso(mensagemErro(error));

                            return;
                        }

                        // Tabela antiga por profissional (se ainda existir):
                        // limpa para o serviço não voltar. Erro aqui é ignorado.
                        await supabaseClient
                            .from("servicos_profissionais")
                            .delete()
                            .ilike("servico", nome);

                        linhas = linhas.filter((_, index) => index !== i);

                        desenhar();

                        aviso(`Serviço "${nome}" excluído com sucesso.`);

                    } catch (erro) {

                        console.error("Erro inesperado ao excluir serviço:", erro);

                        aviso("Não foi possível excluir o serviço.");

                    } finally {

                        button.disabled = false;

                    }

                });

            });

    }


    // ============================================
    // MENSAGEM DE ERRO
    // ============================================

    function mensagemErro(error) {

        const msg =
            (error && (error.message || error.details)) || "";

        const code = (error && error.code) || "";

        if (
            code === "42501" ||
            /permiss|policy|row-level security/i.test(msg)
        ) {
            return "Sem permissão. Confirme o login de administrador e as políticas RLS do Supabase.";
        }

        if (/disponivel|salvar_precos|does not exist|not find/i.test(msg)) {
            return "A estrutura de preços ainda não foi atualizada. Rode database/supabase-sem-profissionais.sql e depois database/supabase-descricao-servicos.sql.";
        }

        return `Não foi possível concluir: ${msg || "verifique o console"}`;

    }


    // ============================================
    // CARREGAR PREÇOS
    // ============================================

    window.carregarPrecos = async function () {

        aviso("Carregando…");

        const { data, error } = await supabaseClient
            .from("servicos_precos")
            .select("nome, preco, disponivel, descricao");

        if (error) {

            console.error(error);

            aviso(mensagemErro(error));

            return;
        }

        linhas = montarLinhas(data || []);

        aviso("");

        desenhar();

    };


    // ============================================
    // ADICIONAR SERVIÇO
    // ============================================

    $("prAdd").addEventListener("click", () => {

        const n = $("prNovoNome").value.trim();

        if (!n) return;

        if (!linhas.some(l => igual(l.nome, n))) {

            linhas.push({
                nome: n,
                preco: null,
                disponivel: true,
                descricao: ""
            });

            aviso(`"${n}" adicionado na lista. Preencha preço e descrição e clique em "Salvar alterações" para publicar no site.`);

        } else {

            aviso(`"${n}" já está na lista.`);

        }

        $("prNovoNome").value = "";

        desenhar();

    });


    // ============================================
    // PREENCHER AGENDAMENTOS SEM VALOR
    // ============================================

    async function preencherSemValor() {

        const { data, error } =
            await supabaseClient.rpc("aplicar_precos_servicos");

        if (error) {

            console.error("Erro ao preencher atendimentos sem valor:", error);

            aviso(mensagemErro(error));

            return null;

        }

        return data || 0;

    }


    // ============================================
    // SALVAR ALTERAÇÕES
    // ============================================

    $("prSalvar").addEventListener("click", async () => {

        if (!linhas.length) {

            aviso("Adicione ao menos um serviço.");

            return;

        }

        const itens = linhas.map(l => ({
            nome: l.nome,
            preco:
                l.preco === null ||
                l.preco === undefined ||
                Number.isNaN(l.preco)
                    ? null
                    : l.preco,
            disponivel: l.disponivel !== false,
            descricao: String(l.descricao || "").trim()
        }));

        const semPreco = itens.filter(
            i => i.disponivel && i.preco === null
        ).length;

        const botao = $("prSalvar");

        botao.disabled = true;

        aviso("Salvando…");

        try {

            const { data, error } = await supabaseClient.rpc(
                "salvar_precos",
                { p_precos: itens }
            );

            if (error) {

                console.error("Erro ao salvar preços:", error);

                aviso(mensagemErro(error));

                return;

            }

            await window.carregarPrecos();

            aviso(
                `${Number(data) || 0} serviço(s) salvo(s). O site já mostra as mudanças.` +
                (semPreco
                    ? ` Atenção: ${semPreco} sem preço não aparece(m) para o cliente.`
                    : "")
            );

        } finally {

            botao.disabled = false;

        }

    });


    // ============================================
    // APLICAR PREÇOS NOS AGENDAMENTOS ANTIGOS
    // ============================================

    $("prAplicar").addEventListener("click", async () => {

        aviso("Aplicando…");

        const total = await preencherSemValor();

        if (total === null) return;

        aviso(
            total === 0
                ? "Nenhum atendimento sem valor encontrado."
                : `${total} atendimento(s) antigo(s) preenchido(s).`
        );

    });


    // ============================================
    // NAVEGAÇÃO
    // ============================================

    $("navPrecos").addEventListener("click", e => {

        e.preventDefault();

        mostrarPagina("precos");

    });

})();
