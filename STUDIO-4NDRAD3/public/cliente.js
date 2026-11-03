// ============================================================
// MARGEM AUTO — Área do cliente
// Login com e-mail e senha (Supabase Auth)
// Cada cliente vê, remarca e cancela SOMENTE os próprios agendamentos
// ============================================================
(() => {
    "use strict";

    const C = window.STUDIO_CONFIG;

    const SUPABASE_URL = "https://kliiyznbugxfolcauopi.supabase.co";
    const SUPABASE_KEY = "sb_publishable_eSYeWOHTNVlotqwwdyt8BQ_i7ddVOEp";

    const sb = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];

    const esc = t =>
        String(t ?? "").replace(
            /[&<>"']/g,
            c => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[c])
        );

    const ANT_MS =
        (C.antecedenciaHoras || 2) *
        3600 *
        1000;

    const SEM = [
        "dom",
        "seg",
        "ter",
        "qua",
        "qui",
        "sex",
        "sáb"
    ];

    const MES = [
        "jan",
        "fev",
        "mar",
        "abr",
        "mai",
        "jun",
        "jul",
        "ago",
        "set",
        "out",
        "nov",
        "dez"
    ];

    let perfil = null;
    let usuario = null;
    let itens = [];
    let aba = "prox";
    let carregando = false;
    let recuperando =
        /type=recovery/.test(location.hash);


    // ============================================================
    // UTILIDADES
    // ============================================================

    const ymd = d =>
        `${d.getFullYear()}-${String(
            d.getMonth() + 1
        ).padStart(2, "0")}-${String(
            d.getDate()
        ).padStart(2, "0")}`;

    const parseData = (
        d,
        h = "00:00"
    ) => {
        const [a, m, di] =
            d.split("-").map(Number);

        const [hh, mm] =
            h.split(":").map(Number);

        return new Date(
            a,
            m - 1,
            di,
            hh,
            mm
        );
    };

    const dataBR = v => {
        const [a, m, d] =
            v.split("-");

        return `${d}/${m}/${a}`;
    };

    const quando = it =>
        parseData(
            it.data,
            it.horario
        );


    function toast(msg) {
        const t = $("#toast");

        if (!t) return;

        t.textContent = msg;
        t.classList.add("on");

        clearTimeout(toast.t);

        toast.t = setTimeout(
            () =>
                t.classList.remove("on"),
            4200
        );
    }


    function setErro(form, msg) {
        const e =
            form.querySelector(
                "[data-erro]"
            );

        if (e) {
            e.textContent =
                msg || "";
        }
    }


    function ocupado(
        btn,
        on,
        txt
    ) {
        if (!btn) return;

        if (on) {
            btn.dataset.t =
                btn.innerHTML;

            btn.disabled = true;

            if (txt) {
                btn.textContent =
                    txt;
            }
        } else {
            btn.disabled = false;

            if (btn.dataset.t) {
                btn.innerHTML =
                    btn.dataset.t;
            }
        }
    }


    function mascaraWa(input) {
        input.addEventListener(
            "input",
            () => {
                const v =
                    input.value
                        .replace(/\D/g, "")
                        .substring(
                            0,
                            11
                        );

                input.value =
                    v.length <= 2
                        ? (
                            v
                                ? `(${v}`
                                : ""
                        )
                        : v.length <= 7
                            ? `(${v.substring(
                                0,
                                2
                            )}) ${v.substring(
                                2
                            )}`
                            : `(${v.substring(
                                0,
                                2
                            )}) ${v.substring(
                                2,
                                7
                            )}-${v.substring(
                                7
                            )}`;
            }
        );
    }


    const emailOk =
        e =>
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
                .test(e);


    const waOk = v => {
        const n =
            v.replace(
                /\D/g,
                ""
            );

        return (
            n.length >= 10 &&
            n.length <= 13
        );
    };


    function traduzErro(err) {
        const m =
            (
                err &&
                (
                    err.message ||
                    err.error_description
                ) ||
                ""
            ).toLowerCase();

        if (
            m.includes(
                "invalid login"
            )
        ) {
            return "E-mail ou senha incorretos.";
        }

        if (
            m.includes(
                "not confirmed"
            )
        ) {
            return "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada (e no spam).";
        }

        if (
            m.includes(
                "already registered"
            ) ||
            m.includes(
                "already been registered"
            )
        ) {
            return "Já existe uma conta com esse e-mail. Entre ou recupere a senha.";
        }

        if (
            m.includes(
                "rate limit"
            ) ||
            m.includes(
                "too many"
            ) ||
            m.includes(
                "security purposes"
            )
        ) {
            return "Muitas tentativas. Aguarde um minuto e tente de novo.";
        }

        if (
            m.includes("password") &&
            (
                m.includes("least") ||
                m.includes("weak") ||
                m.includes("short")
            )
        ) {
            return "Senha fraca. Use pelo menos 8 caracteres.";
        }

        if (
            m.includes(
                "same password"
            ) ||
            m.includes(
                "different from the old"
            )
        ) {
            return "A nova senha precisa ser diferente da atual.";
        }

        if (
            m.includes(
                "failed to fetch"
            ) ||
            m.includes(
                "network"
            )
        ) {
            return "Sem conexão. Verifique a internet e tente de novo.";
        }

        return "Não foi possível concluir. Tente novamente.";
    }


    const semFuncao =
        err =>
            !!err &&
            (
                err.code ===
                    "PGRST202" ||
                err.code ===
                    "42883" ||
                /could not find the function|function .* does not exist/i
                    .test(
                        err.message ||
                        ""
                    )
            );


    const MSG_SETUP =
        "A área do cliente ainda não foi ativada no banco de dados. Rode o arquivo database/supabase-area-cliente.sql no Supabase.";


    // ============================================================
    // MENU MOBILE
    // ============================================================

    const hd = $("#hd");
    const nav = $("#nav");
    const burger = $("#burger");


    function toggleMenu(open) {
        nav.classList.toggle(
            "open",
            open
        );

        hd.classList.toggle(
            "menu",
            open
        );

        burger.setAttribute(
            "aria-expanded",
            open
        );

        burger.setAttribute(
            "aria-label",
            open
                ? "Fechar menu"
                : "Abrir menu"
        );

        document.body.style.overflow =
            open
                ? "hidden"
                : "";
    }


    burger.addEventListener(
        "click",
        () =>
            toggleMenu(
                !nav.classList.contains(
                    "open"
                )
            )
    );


    nav.addEventListener(
        "click",
        e => {
            if (
                e.target.closest(
                    "a, button"
                )
            ) {
                toggleMenu(false);
            }
        }
    );


    $("#goAgendar").addEventListener(
        "click",
        () => {
            location.href =
                "index.html#agendar";
        }
    );


    $("#clNovo").addEventListener(
        "click",
        () => {
            location.href =
                "index.html#agendar";
        }
    );


    $("#yr").textContent =
        new Date().getFullYear();


    // ============================================================
    // TELAS
    // ============================================================

    function mostrar(tela) {
        $("#vAuth").hidden =
            tela !== "auth";

        $("#vLista").hidden =
            tela !== "lista";
    }


    const TEXTOS = {
        entrar: [
            "Entrar.",
            "Acesse sua conta para ver, remarcar ou cancelar seus horários."
        ],

        criar: [
            "Criar conta.",
            "Leva menos de um minuto. Seus agendamentos feitos logado ficam salvos aqui."
        ],

        esqueci: [
            "Recuperar senha.",
            "Informe o e-mail da conta e enviaremos um link para criar uma nova senha."
        ],

        nova: [
            "Nova senha.",
            "Defina uma nova senha para a sua conta."
        ]
    };


    function modoAuth(modo) {
        const box =
            $("#vAuth");

        box.dataset.mode =
            modo;

        $("#auTitulo").textContent =
            TEXTOS[modo][0];

        $("#auSub").textContent =
            TEXTOS[modo][1];

        $$("#vAuth form").forEach(
            f => {
                f.hidden =
                    f.dataset.f !==
                    modo;

                setErro(
                    f,
                    ""
                );
            }
        );

        $$("#auTabs .tab").forEach(
            t => {
                const on =
                    t.dataset.mode ===
                    modo;

                t.classList.toggle(
                    "on",
                    on
                );

                t.setAttribute(
                    "aria-selected",
                    on
                );
            }
        );

        $("#auOk").hidden =
            true;

        mostrar("auth");
    }


    $("#auTabs").addEventListener(
        "click",
        e => {
            const t =
                e.target.closest(
                    ".tab"
                );

            if (t) {
                modoAuth(
                    t.dataset.mode
                );
            }
        }
    );


    $("#vAuth").addEventListener(
        "click",
        e => {
            const g =
                e.target.closest(
                    "[data-go]"
                );

            if (g) {
                modoAuth(
                    g.dataset.go
                );
            }
        }
    );


    function avisoAuth(txt) {
        const o =
            $("#auOk");

        o.textContent =
            txt;

        o.hidden = false;
    }


    // ============================================================
    // CADASTRO / LOGIN
    // ============================================================

    mascaraWa(
        $("#crWa")
    );

    mascaraWa(
        $("#pfWa")
    );


    $("#fEntrar").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const email =
                $("#enEmail")
                    .value
                    .trim();

            const senha =
                $("#enSenha")
                    .value;

            if (
                !emailOk(email) ||
                !senha
            ) {
                return setErro(
                    f,
                    "Informe e-mail e senha."
                );
            }

            const btn =
                f.querySelector(
                    "[type=submit]"
                );

            ocupado(
                btn,
                true,
                "Entrando…"
            );

            setErro(
                f,
                ""
            );

            const {
                error
            } =
                await sb.auth.signInWithPassword(
                    {
                        email,
                        password:
                            senha
                    }
                );

            ocupado(
                btn,
                false
            );

            if (error) {
                return setErro(
                    f,
                    traduzErro(error)
                );
            }

            f.reset();
        }
    );


    $("#fCriar").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const nome =
                $("#crNome")
                    .value
                    .trim();

            const wa =
                $("#crWa")
                    .value
                    .replace(
                        /\D/g,
                        ""
                    );

            const email =
                $("#crEmail")
                    .value
                    .trim();

            const senha =
                $("#crSenha")
                    .value;

            if (!nome)
                return setErro(
                    f,
                    "Informe seu nome."
                );

            if (!waOk(wa))
                return setErro(
                    f,
                    "Informe um WhatsApp válido, com DDD."
                );

            if (!emailOk(email))
                return setErro(
                    f,
                    "Informe um e-mail válido."
                );

            if (senha.length < 8)
                return setErro(
                    f,
                    "A senha precisa ter pelo menos 8 caracteres."
                );

            const btn =
                f.querySelector(
                    "[type=submit]"
                );

            ocupado(
                btn,
                true,
                "Criando conta…"
            );

            setErro(
                f,
                ""
            );

            const {
                data,
                error
            } =
                await sb.auth.signUp(
                    {
                        email,
                        password:
                            senha,

                        options: {
                            data: {
                                tipo: "cliente",
                                nome,
                                whatsapp:
                                    wa
                            },

                            emailRedirectTo:
                                location.href.split(
                                    "#"
                                )[0]
                        }
                    }
                );

            ocupado(
                btn,
                false
            );

            if (error)
                return setErro(
                    f,
                    traduzErro(error)
                );

            if (
                data.user &&
                Array.isArray(
                    data.user.identities
                ) &&
                data.user.identities
                    .length === 0
            ) {
                return setErro(
                    f,
                    traduzErro({
                        message:
                            "User already registered"
                    })
                );
            }

            f.reset();

            if (!data.session) {
                modoAuth(
                    "entrar"
                );

                avisoAuth(
                    "Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre aqui."
                );
            }
        }
    );


    $("#fEsqueci").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const email =
                $("#esEmail")
                    .value
                    .trim();

            if (!emailOk(email))
                return setErro(
                    f,
                    "Informe um e-mail válido."
                );

            const btn =
                f.querySelector(
                    "[type=submit]"
                );

            ocupado(
                btn,
                true,
                "Enviando…"
            );

            setErro(
                f,
                ""
            );

            const {
                error
            } =
                await sb.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo:
                            location.href.split(
                                "#"
                            )[0]
                    }
                );

            ocupado(
                btn,
                false
            );

            if (error)
                return setErro(
                    f,
                    traduzErro(error)
                );

            f.reset();

            avisoAuth(
                "Se existir uma conta com esse e-mail, enviamos o link para criar uma nova senha."
            );
        }
    );


    $("#fNova").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const senha =
                $("#nvSenha")
                    .value;

            if (senha.length < 8)
                return setErro(
                    f,
                    "A senha precisa ter pelo menos 8 caracteres."
                );

            const btn =
                f.querySelector(
                    "[type=submit]"
                );

            ocupado(
                btn,
                true,
                "Salvando…"
            );

            setErro(
                f,
                ""
            );

            const {
                error
            } =
                await sb.auth.updateUser(
                    {
                        password:
                            senha
                    }
                );

            ocupado(
                btn,
                false
            );

            if (error)
                return setErro(
                    f,
                    traduzErro(error)
                );

            f.reset();

            toast(
                "Senha alterada com sucesso."
            );

            recuperando =
                false;

            iniciarSessao();
        }
    );


    $("#clSair").addEventListener(
        "click",
        async () => {
            await sb.auth.signOut();

            perfil = null;
            usuario = null;
            itens = [];

            modoAuth(
                "entrar"
            );

            toast(
                "Você saiu da conta."
            );
        }
    );


    // ============================================================
    // SESSÃO
    // ============================================================

    async function iniciarSessao() {
        if (
            carregando ||
            recuperando
        ) {
            return;
        }

        carregando = true;

        try {
            const {
                data: {
                    session
                }
            } =
                await sb.auth.getSession();

            if (!session) {
                modoAuth(
                    "entrar"
                );

                return;
            }

            usuario =
                session.user;

            await carregarPerfil();

            if (!perfil)
                return;

            mostrar(
                "lista"
            );

            await carregarAgendamentos();

        } finally {
            carregando = false;
        }
    }


    async function carregarPerfil() {
        const {
            data,
            error
        } =
            await sb
                .from("clientes")
                .select(
                    "nome, whatsapp"
                )
                .eq(
                    "user_id",
                    usuario.id
                )
                .maybeSingle();

        if (error) {
            console.error(
                "Erro ao carregar perfil:",
                error
            );

            mostrar(
                "lista"
            );

            avisoLista(
                semFuncao(error) ||
                error.code ===
                    "42P01"
                    ? MSG_SETUP
                    : "Não foi possível carregar seus dados."
            );

            perfil = {
                nome:
                    (
                        usuario.user_metadata &&
                        usuario.user_metadata
                            .nome
                    ) ||
                    "",

                whatsapp: ""
            };

        } else if (data) {
            perfil = data;

        } else {
            perfil = null;

            mostrar(
                "lista"
            );

            $("#clOla").textContent =
                "Complete seu cadastro.";

            abrirPerfil(
                true
            );

            return;
        }

        $("#clOla").textContent =
            perfil.nome
                ? `Olá, ${perfil.nome.split(" ")[0]}.`
                : "Olá.";
    }


    sb.auth.onAuthStateChange(
        (
            evento,
            session
        ) => {
            setTimeout(
                () => {
                    if (
                        evento ===
                        "PASSWORD_RECOVERY"
                    ) {
                        recuperando =
                            true;

                        modoAuth(
                            "nova"
                        );

                    } else if (
                        evento ===
                        "SIGNED_IN"
                    ) {
                        if (
                            usuario &&
                            perfil &&
                            session &&
                            session.user.id ===
                                usuario.id
                        ) {
                            return;
                        }

                        iniciarSessao();

                    } else if (
                        evento ===
                        "SIGNED_OUT"
                    ) {
                        perfil = null;
                        usuario = null;
                        recuperando =
                            false;

                        modoAuth(
                            "entrar"
                        );
                    }
                },
                0
            );
        }
    );


    // ============================================================
    // LISTA DE AGENDAMENTOS
    // ============================================================

    function avisoLista(txt) {
        const a =
            $("#clAviso");

        a.textContent =
            txt || "";

        a.hidden =
            !txt;
    }


    async function carregarAgendamentos() {
        avisoLista(
            ""
        );

        $("#clCards").innerHTML =
            `<div class="vazio">Carregando…</div>`;

        const {
            data,
            error
        } =
            await sb.rpc(
                "cliente_agendamentos"
            );

        if (error) {
            console.error(
                "Erro ao listar agendamentos:",
                error
            );

            itens = [];

            avisoLista(
                semFuncao(error)
                    ? MSG_SETUP
                    : "Não foi possível carregar seus agendamentos. Tente novamente."
            );

            return desenhar();
        }

        itens =
            (data || []).map(
                r => ({
                    ...r,
                    horario:
                        String(
                            r.horario ||
                            ""
                        ).substring(
                            0,
                            5
                        )
                })
            );

        desenhar();
    }


    $(".tabs:not(.tabs-auth)")
        .addEventListener(
            "click",
            e => {
                const t =
                    e.target.closest(
                        ".tab"
                    );

                if (!t) return;

                aba =
                    t.dataset.tab;

                $$(".tabs:not(.tabs-auth) .tab")
                    .forEach(
                        b => {
                            const on =
                                b === t;

                            b.classList.toggle(
                                "on",
                                on
                            );

                            b.setAttribute(
                                "aria-selected",
                                on
                            );
                        }
                    );

                desenhar();
            }
        );


    // ============================================================
    // STATUS
    // ============================================================

    const rotulo = {
        confirmado:
            "Confirmado",

        cancelado:
            "Cancelado pelo estabelecimento",

        compareceu:
            "Concluído",

        faltou:
            "Não compareceu"
    };


    const emAndamento =
        it =>
            it.status ===
                "confirmado" &&
            quando(it).getTime() >=
                Date.now() -
                    3600 *
                        1000;


    // ============================================================
    // DESENHAR LISTA
    // ============================================================

    function desenhar() {
        const prox =
            itens
                .filter(
                    emAndamento
                )
                .sort(
                    (a, b) =>
                        quando(a) -
                        quando(b)
                );

        const hist =
            itens
                .filter(
                    i =>
                        !emAndamento(
                            i
                        )
                )
                .sort(
                    (a, b) =>
                        quando(b) -
                        quando(a)
                );

        $("#nProx").textContent =
            prox.length;

        $("#nHist").textContent =
            hist.length;

        const lista =
            aba === "prox"
                ? prox
                : hist;

        const box =
            $("#clCards");

        if (!lista.length) {
            box.innerHTML =
                aba === "prox"
                    ? `
                        <div class="vazio">
                            <strong>Nenhum horário marcado</strong>
                            Que tal garantir o próximo?
                            <br>
                            <button
                                type="button"
                                class="btn solid"
                                data-novo
                            >
                                Agendar agora
                                <span
                                    class="arr"
                                    aria-hidden="true"
                                >
                                    →
                                </span>
                            </button>
                        </div>
                    `
                    : `
                        <div class="vazio">
                            <strong>Sem histórico ainda</strong>
                            Seus atendimentos e cancelamentos aparecem aqui.
                        </div>
                    `;

            return;
        }

        box.innerHTML =
            lista
                .map(
                    cardHtml
                )
                .join("");
    }


    // ============================================================
    // AÇÕES DOS CARDS
    // ============================================================

    $("#clCards").addEventListener(
        "click",
        e => {
            if (
                e.target.closest(
                    "[data-novo]"
                )
            ) {
                location.href =
                    "index.html#agendar";

                return;
            }

            const b =
                e.target.closest(
                    "[data-act]"
                );

            if (!b) return;

            const it =
                itens.find(
                    i =>
                        String(
                            i.id
                        ) ===
                        String(
                            b.dataset.id
                        )
                );

            if (!it) return;


            // ====================================================
            // IMPORTANTE:
            // Se o dono cancelou o agendamento,
            // nenhuma ação pode ser executada.
            // ====================================================

            if (
                it.status ===
                "cancelado"
            ) {
                toast(
                    "Este agendamento foi cancelado pelo estabelecimento."
                );

                return;
            }


            if (
                b.dataset.act ===
                "tarde"
            ) {
                toast(
                    `Faltam menos de ${
                        C.antecedenciaHoras ||
                        2
                    }h. Para cancelar, fale com a MARGEM AUTO no WhatsApp.`
                );

                return;
            }


            ({
                cancel:
                    abrirCancelar,

                edit:
                    abrirRemarcar,

                ics:
                    baixarIcs

            })[
                b.dataset.act
            ]?.(it);
        }
    );


    const noPrazo =
        it =>
            quando(it).getTime() -
                Date.now() >=
            ANT_MS;


    function linkWa(it) {
        const txt =
            `Olá! Sou ${
                perfil?.nome ||
                it.nome ||
                ""
            }. Sobre meu agendamento (${
                it.procedimento
            }) em ${
                dataBR(it.data)
            } às ${
                it.horario
            }: `;

        return `https://wa.me/${
            C.whatsapp
        }?text=${
            encodeURIComponent(
                txt
            )
        }`;
    }


    // ============================================================
    // CARD DO AGENDAMENTO
    // ============================================================

    function cardHtml(
        it,
        i
    ) {
        const d =
            parseData(
                it.data,
                it.horario
            );

        const ativo =
            emAndamento(
                it
            );


        // ========================================================
        // CANCELADO PELO ESTABELECIMENTO
        // ========================================================

        const canceladoPeloEstabelecimento =
            it.status ===
            "cancelado";


        const chipClasse =
            canceladoPeloEstabelecimento
                ? "off"
                : it.status ===
                    "confirmado"
                    ? "ok"
                    : "off";


        const chip =
            `
                <span
                    class="chip ${chipClasse}"
                >
                    ${esc(
                        rotulo[
                            it.status
                        ] ||
                        it.status
                    )}
                </span>
            `;


        let acoes = "";


        // ========================================================
        // AGENDAMENTO NORMAL
        // ========================================================

        if (
            ativo &&
            !canceladoPeloEstabelecimento &&
            noPrazo(it)
        ) {
            acoes = `
                <button
                    type="button"
                    class="btn solid"
                    data-act="edit"
                    data-id="${esc(it.id)}"
                >
                    Remarcar
                </button>

                <button
                    type="button"
                    class="btn ghost"
                    data-act="cancel"
                    data-id="${esc(it.id)}"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    class="btn ghost"
                    data-act="ics"
                    data-id="${esc(it.id)}"
                >
                    Calendário
                </button>
            `;


        // ========================================================
        // AGENDAMENTO PERTO DO HORÁRIO
        // ========================================================

        } else if (
            ativo &&
            !canceladoPeloEstabelecimento
        ) {
            acoes = `
                <button
                    type="button"
                    class="btn ghost"
                    data-act="tarde"
                    data-id="${esc(it.id)}"
                >
                    Cancelar
                </button>

                <a
                    class="btn solid"
                    target="_blank"
                    rel="noopener"
                    href="${linkWa(it)}"
                >
                    WhatsApp
                </a>

                <button
                    type="button"
                    class="btn ghost"
                    data-act="ics"
                    data-id="${esc(it.id)}"
                >
                    Calendário
                </button>
            `;
        }


        // ========================================================
        // AVISO DE CANCELAMENTO PELO ESTABELECIMENTO
        // ========================================================

        const notaCancelado =
            canceladoPeloEstabelecimento
                ? `
                    <p class="card-note">
                        Este horário foi cancelado pelo estabelecimento.
                    </p>
                `
                : "";


        // ========================================================
        // AVISO DE ANTECEDÊNCIA
        // ========================================================

        const notaPrazo =
            ativo &&
            !canceladoPeloEstabelecimento &&
            !noPrazo(it)
                ? `
                    <p class="card-note">
                        Faltam menos de ${
                            C.antecedenciaHoras ||
                            2
                        }h: para alterar ou cancelar, fale com a MARGEM AUTO pelo WhatsApp.
                    </p>
                `
                : "";


        return `
            <article
                class="card ${
                    ativo &&
                    !canceladoPeloEstabelecimento
                        ? ""
                        : "past"
                }"
                style="animation-delay:${Math.min(
                    i,
                    8
                ) * 60}ms"
            >

                <div class="card-date">
                    <small>
                        ${SEM[d.getDay()]}
                    </small>

                    <b>
                        ${String(
                            d.getDate()
                        ).padStart(
                            2,
                            "0"
                        )}
                    </b>

                    <small>
                        ${MES[d.getMonth()]}
                    </small>
                </div>


                <div class="card-main">

                    <h3>
                        ${esc(
                            it.procedimento
                        )}
                    </h3>


                    <div class="card-meta">

                        <span>
                            ${dataBR(
                                it.data
                            )}
                            às
                            ${esc(
                                it.horario
                            )}
                        </span>

                        ${chip}

                    </div>

                </div>


                ${
                    acoes
                        ? `
                            <div class="card-act">
                                ${acoes}
                            </div>
                        `
                        : ""
                }


                ${notaCancelado}

                ${notaPrazo}

            </article>
        `;
    }


    // ============================================================
    // CALENDÁRIO
    // ============================================================

    function baixarIcs(it) {
        const p =
            n =>
                String(n).padStart(
                    2,
                    "0"
                );

        const fmt =
            d =>
                `${d.getFullYear()}${p(
                    d.getMonth() + 1
                )}${p(
                    d.getDate()
                )}T${p(
                    d.getHours()
                )}${p(
                    d.getMinutes()
                )}00`;

        const ini =
            quando(it);

        const fim =
            new Date(
                ini.getTime() +
                    3600 *
                        1000
            );

        const ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//MARGEM AUTO//PT-BR",
            "BEGIN:VEVENT",
            `UID:${it.id}-${it.data}@margemauto`,
            `DTSTAMP:${fmt(
                new Date()
            )}`,
            `DTSTART:${fmt(
                ini
            )}`,
            `DTEND:${fmt(
                fim
            )}`,
            `SUMMARY:MARGEM AUTO - ${it.procedimento}`,
            `LOCATION:${String(
                C.endereco
            ).replace(
                /[,;]/g,
                " "
            )}`,
            "BEGIN:VALARM",
            "TRIGGER:-PT2H",
            "ACTION:DISPLAY",
            "DESCRIPTION:Seu horário no MARGEM AUTO",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR"
        ].join(
            "\r\n"
        );

        const url =
            URL.createObjectURL(
                new Blob(
                    [ics],
                    {
                        type:
                            "text/calendar;charset=utf-8"
                    }
                )
            );

        const a =
            Object.assign(
                document.createElement(
                    "a"
                ),
                {
                    href: url,
                    download:
                        "margem-auto.ics"
                }
            );

        document.body.appendChild(
            a
        );

        a.click();
        a.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            2000
        );
    }


    // ============================================================
    // MODAIS
    // ============================================================

    let modalAberto = null;
    let ultimoFoco = null;


    function abrirModal(id) {
        ultimoFoco =
            document.activeElement;

        modalAberto = id;

        const m = $(id);

        m.classList.add(
            "open"
        );

        m.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow =
            "hidden";
    }


    function fecharModal() {
        if (!modalAberto)
            return;

        const m =
            $(modalAberto);

        m.classList.remove(
            "open"
        );

        m.setAttribute(
            "aria-hidden",
            "true"
        );

        modalAberto = null;

        document.body.style.overflow =
            "";

        if (
            ultimoFoco &&
            ultimoFoco.focus
        ) {
            ultimoFoco.focus({
                preventScroll:
                    true
            });
        }
    }


    document.addEventListener(
        "click",
        e => {
            if (
                e.target.closest(
                    "[data-mclose]"
                )
            ) {
                fecharModal();
            }
        }
    );


    addEventListener(
        "keydown",
        e => {
            if (
                e.key ===
                "Escape"
            ) {
                if (
                    modalAberto
                ) {
                    fecharModal();
                } else if (
                    nav.classList.contains(
                        "open"
                    )
                ) {
                    toggleMenu(
                        false
                    );
                }
            }
        }
    );


    // ============================================================
    // MENSAGENS
    // ============================================================

    const MSG_RES = {
        nao_encontrado:
            "Não encontramos esse agendamento na sua conta.",

        indisponivel:
            "Este agendamento não pode mais ser alterado.",

        prazo:
            `Prazo encerrado: só é possível alterar com ${
                C.antecedenciaHoras ||
                2
            }h de antecedência. Fale com a MARGEM AUTO pelo WhatsApp.`,

        ocupado:
            "Esse horário acabou de ser ocupado. Escolha outro.",

        invalido:
            "Dados inválidos. Revise e tente novamente."
    };


    // ============================================================
    // CANCELAR PELO CLIENTE
    // ============================================================

    let alvo = null;


    function abrirCancelar(it) {

        // Segurança visual adicional:
        // se o dono já cancelou, não abre o modal.

        if (
            it.status ===
            "cancelado"
        ) {
            toast(
                "Este agendamento já foi cancelado pelo estabelecimento."
            );

            return;
        }

        alvo = it;

        $("#mcTxt").textContent =
            `${it.procedimento} · ${dataBR(
                it.data
            )} às ${
                it.horario
            }. O horário volta a ficar disponível para outros clientes.`;

        $("#mcErr").textContent =
            "";

        abrirModal(
            "#mCancel"
        );
    }


    $("#mcOk").addEventListener(
        "click",
        async () => {

            if (!alvo)
                return;


            if (
                alvo.status ===
                "cancelado"
            ) {
                fecharModal();

                toast(
                    "Este agendamento já foi cancelado pelo estabelecimento."
                );

                return;
            }


            const btn =
                $("#mcOk");

            ocupado(
                btn,
                true,
                "Cancelando…"
            );


            const {
                data,
                error
            } =
                await sb.rpc(
                    "cliente_cancelar",
                    {
                        p_id:
                            alvo.id
                    }
                );


            ocupado(
                btn,
                false
            );


            if (error) {
                console.error(
                    error
                );

                $("#mcErr").textContent =
                    semFuncao(
                        error
                    )
                        ? MSG_SETUP
                        : "Não foi possível cancelar. Tente novamente.";

                return;
            }


            if (
                data !==
                "ok"
            ) {
                $("#mcErr").textContent =
                    MSG_RES[
                        data
                    ] ||
                    "Não foi possível cancelar.";

                if (
                    data ===
                        "indisponivel" ||
                    data ===
                        "nao_encontrado"
                ) {
                    carregarAgendamentos();
                }

                return;
            }


            fecharModal();

            toast(
                "Horário cancelado."
            );

            carregarAgendamentos();
        }
    );


    // ============================================================
    // REMARCAR
    // ============================================================

    const ed = {
        it: null,
        serv: "",
        data: "",
        hor: "",
        ocupados: []
    };


    function abrirRemarcar(it) {

        if (
            it.status ===
            "cancelado"
        ) {
            toast(
                "Este agendamento foi cancelado pelo estabelecimento."
            );

            return;
        }


        Object.assign(
            ed,
            {
                it,
                serv:
                    it.procedimento,
                data:
                    it.data,
                hor:
                    it.horario,
                ocupados: []
            }
        );


        $("#meAtual").textContent =
            `Atual: ${
                it.procedimento
            } · ${
                dataBR(it.data)
            } às ${
                it.horario
            }`;


        $("#meErr").textContent =
            "";


        const servicos =
            C.servicos.map(
                s => s.nome
            );


        if (
            !servicos.includes(
                it.procedimento
            )
        ) {
            servicos.unshift(
                it.procedimento
            );
        }


        $("#meServ").innerHTML =
            servicos
                .map(
                    n =>
                        `
                        <button
                            type="button"
                            class="opt"
                            role="radio"
                            aria-checked="${
                                n ===
                                ed.serv
                            }"
                            data-v="${esc(
                                n
                            )}"
                        >
                            <span>
                                <strong>
                                    ${esc(
                                        n
                                    )}
                                </strong>
                            </span>
                        </button>
                        `
                )
                .join("");


        const base =
            new Date();


        $("#meDias").innerHTML =
            Array.from(
                {
                    length:
                        C.diasNaFaixa ||
                        14
                },
                (_, i) => {

                    const d =
                        new Date(
                            base.getFullYear(),
                            base.getMonth(),
                            base.getDate() +
                                i
                        );

                    const r =
                        i === 0
                            ? "hoje"
                            : i === 1
                                ? "amanhã"
                                : SEM[
                                    d.getDay()
                                ];

                    return `
                        <button
                            type="button"
                            class="day"
                            role="radio"
                            aria-checked="${
                                ymd(d) ===
                                ed.data
                            }"
                            data-v="${ymd(
                                d
                            )}"
                        >
                            <span>
                                ${r}
                            </span>

                            <b>
                                ${d.getDate()}
                            </b>

                            <span>
                                ${
                                    MES[
                                        d.getMonth()
                                    ]
                                }
                            </span>
                        </button>
                    `;
                }
            )
            .join("");


        $("#meData").min =
            ymd(base);

        $("#meData").value =
            ed.data;


        abrirModal(
            "#mEdit"
        );

        carregarHorarios();
    }


    function marcarDia() {
        $$("#meDias .day")
            .forEach(
                b =>
                    b.setAttribute(
                        "aria-checked",
                        b.dataset.v ===
                            ed.data
                    )
            );

        $("#meData").value =
            ed.data;
    }


    function validarEd() {
        const mudou =
            ed.serv !==
                ed.it.procedimento ||
            ed.data !==
                ed.it.data ||
            ed.hor !==
                ed.it.horario;

        $("#meOk").disabled =
            !(
                ed.serv &&
                ed.data &&
                ed.hor &&
                mudou
            );
    }


    async function carregarHorarios() {

        const hint =
            $("#meHint");

        const box =
            $("#meHor");


        if (!ed.data) {
            hint.textContent =
                "Escolha uma data.";

            box.innerHTML =
                "";

            return validarEd();
        }


        hint.textContent =
            "Buscando horários…";

        box.innerHTML =
            "";


        const dia =
            ed.data;


        const {
            data,
            error
        } =
            await sb.rpc(
                "horarios_ocupados",
                {
                    data_consulta:
                        dia
                }
            );


        if (
            dia !==
            ed.data
        ) {
            return;
        }


        if (error) {
            console.error(
                error
            );

            hint.textContent =
                "Não foi possível carregar os horários. Escolha o dia novamente.";

            return;
        }


        ed.ocupados =
            (data || [])
                .map(
                    r =>
                        String(
                            r.horario ||
                                ""
                        ).substring(
                            0,
                            5
                        )
                );


        const ehAtual =
            h =>
                dia ===
                    ed.it.data &&
                h ===
                    ed.it.horario;


        let livres = 0;


        box.innerHTML =
            C.horarios
                .map(
                    h => {

                        const passou =
                            parseData(
                                dia,
                                h
                            ).getTime() -
                                Date.now() <
                            ANT_MS;


                        const ocup =
                            ed.ocupados.includes(
                                h
                            ) &&
                            !ehAtual(h);


                        const off =
                            passou ||
                            ocup;


                        if (!off)
                            livres++;


                        return `
                            <button
                                type="button"
                                class="time ${
                                    ehAtual(h)
                                        ? "atual"
                                        : ""
                                }"
                                role="radio"
                                aria-checked="${
                                    h ===
                                        ed.hor &&
                                    dia ===
                                        ed.data
                                }"
                                data-v="${h}"
                                ${
                                    off
                                        ? "disabled"
                                        : ""
                                }
                            >
                                ${h}
                            </button>
                        `;
                    }
                )
                .join("");


        hint.textContent =
            livres
                ? `${dataBR(
                    dia
                )} · ${livres} ${
                    livres > 1
                        ? "horários disponíveis"
                        : "horário disponível"
                }${
                    dia ===
                    ed.it.data
                        ? " (tracejado = seu horário atual)"
                        : ""
                }`
                : "Sem horários livres neste dia. Escolha outra data.";


        validarEd();
    }


    function trocarDia(v) {
        ed.data =
            v;

        ed.hor =
            "";

        marcarDia();

        carregarHorarios();

        validarEd();
    }


    $("#meServ").addEventListener(
        "click",
        e => {
            const b =
                e.target.closest(
                    ".opt"
                );

            if (!b) return;

            ed.serv =
                b.dataset.v;

            $$("#meServ .opt")
                .forEach(
                    x =>
                        x.setAttribute(
                            "aria-checked",
                            x === b
                        )
                );

            validarEd();
        }
    );


    $("#meDias").addEventListener(
        "click",
        e => {
            const b =
                e.target.closest(
                    ".day"
                );

            if (b)
                trocarDia(
                    b.dataset.v
                );
        }
    );


    $("#meData").addEventListener(
        "change",
        e => {
            if (
                e.target.value
            ) {
                trocarDia(
                    e.target.value
                );
            }
        }
    );


    $("#meHor").addEventListener(
        "click",
        e => {
            const b =
                e.target.closest(
                    ".time"
                );

            if (
                !b ||
                b.disabled
            ) {
                return;
            }

            ed.hor =
                b.dataset.v;

            $$("#meHor .time")
                .forEach(
                    x =>
                        x.setAttribute(
                            "aria-checked",
                            x === b
                        )
                );

            validarEd();
        }
    );


    $("#meOk").addEventListener(
        "click",
        async () => {

            if (
                !ed.it ||
                ed.it.status ===
                    "cancelado"
            ) {
                fecharModal();

                toast(
                    "Este agendamento foi cancelado pelo estabelecimento."
                );

                return;
            }


            const btn =
                $("#meOk");

            ocupado(
                btn,
                true,
                "Salvando…"
            );

            $("#meErr").textContent =
                "";


            const {
                data,
                error
            } =
                await sb.rpc(
                    "cliente_remarcar",
                    {
                        p_id:
                            ed.it.id,

                        p_procedimento:
                            ed.serv,

                        p_data:
                            ed.data,

                        p_horario:
                            ed.hor
                    }
                );


            ocupado(
                btn,
                false
            );

            validarEd();


            if (error) {
                console.error(
                    error
                );

                $("#meErr").textContent =
                    semFuncao(
                        error
                    )
                        ? MSG_SETUP
                        : "Não foi possível salvar. Tente novamente.";

                return;
            }


            if (
                data !==
                "ok"
            ) {
                $("#meErr").textContent =
                    MSG_RES[
                        data
                    ] ||
                    "Não foi possível salvar.";

                if (
                    data ===
                    "ocupado"
                ) {
                    ed.hor =
                        "";

                    carregarHorarios();
                }

                return;
            }


            fecharModal();

            toast(
                "Horário atualizado."
            );

            carregarAgendamentos();
        }
    );


    // ============================================================
    // MEUS DADOS
    // ============================================================

    function abrirPerfil(
        obrigatorio
    ) {
        $("#mpEmail").textContent =
            usuario
                ? `Conta: ${usuario.email}`
                : "";

        $("#pfNome").value =
            perfil?.nome ||
            (
                usuario?.user_metadata
                    ?.nome
            ) ||
            "";

        const w =
            perfil?.whatsapp ||
            "";

        $("#pfWa").value =
            w;

        $("#pfWa").dispatchEvent(
            new Event("input")
        );

        $("#pfSenha").value =
            "";

        $$("#mPerfil [data-erro]")
            .forEach(
                e =>
                    (e.textContent =
                        "")
            );

        $("#mPerfil").dataset.novo =
            obrigatorio
                ? "1"
                : "";

        abrirModal(
            "#mPerfil"
        );
    }


    $("#clPerfil").addEventListener(
        "click",
        () =>
            abrirPerfil(
                false
            )
    );


    $("#fPerfil").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const nome =
                $("#pfNome")
                    .value
                    .trim();

            const wa =
                $("#pfWa")
                    .value
                    .replace(
                        /\D/g,
                        ""
                    );


            if (!nome)
                return setErro(
                    f,
                    "Informe seu nome."
                );


            if (!waOk(wa))
                return setErro(
                    f,
                    "Informe um WhatsApp válido, com DDD."
                );


            const btn =
                f.querySelector(
                    "[type=submit]"
                );


            ocupado(
                btn,
                true,
                "Salvando…"
            );


            setErro(
                f,
                ""
            );


            const novo =
                $("#mPerfil")
                    .dataset
                    .novo ===
                "1";


            const q =
                novo
                    ? sb
                        .from(
                            "clientes"
                        )
                        .insert({
                            user_id:
                                usuario.id,

                            nome,

                            whatsapp:
                                wa
                        })

                    : sb
                        .from(
                            "clientes"
                        )
                        .update({
                            nome,

                            whatsapp:
                                wa
                        })
                        .eq(
                            "user_id",
                            usuario.id
                        );


            const {
                error
            } =
                await q;


            ocupado(
                btn,
                false
            );


            if (error) {
                console.error(
                    error
                );

                return setErro(
                    f,
                    "Não foi possível salvar seus dados."
                );
            }


            perfil = {
                nome,
                whatsapp:
                    wa
            };


            $("#clOla").textContent =
                `Olá, ${nome.split(" ")[0]}.`;


            fecharModal();

            toast(
                "Dados salvos."
            );


            if (novo) {
                carregarAgendamentos();
            }
        }
    );


    $("#fSenha").addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const f =
                e.target;

            const senha =
                $("#pfSenha")
                    .value;


            if (
                senha.length <
                8
            ) {
                return setErro(
                    f,
                    "A senha precisa ter pelo menos 8 caracteres."
                );
            }


            const btn =
                f.querySelector(
                    "[type=submit]"
                );


            ocupado(
                btn,
                true,
                "Alterando…"
            );


            setErro(
                f,
                ""
            );


            const {
                error
            } =
                await sb.auth.updateUser(
                    {
                        password:
                            senha
                    }
                );


            ocupado(
                btn,
                false
            );


            if (error) {
                return setErro(
                    f,
                    traduzErro(error)
                );
            }


            f.reset();

            fecharModal();

            toast(
                "Senha alterada."
            );
        }
    );


    // ============================================================
    // INÍCIO
    // ============================================================

    if (recuperando) {
        modoAuth(
            "nova"
        );
    }

    iniciarSessao();

})();