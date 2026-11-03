// ============================================================
// MARGEM AUTO — configuração editável do site e da área do cliente
// Usada por landing.js (site) e cliente.js (área do cliente).
// ============================================================
window.STUDIO_CONFIG = {
        whatsapp: "5511994583475",
        instagram: "https://instagram.com/",
        maps: "https://maps.google.com/",
        endereco: "Av. Antônio Carlos Comitre, 510, Sala 34 - Ed. Dallas Campolim, Sorocaba, Brazil",
        horario: "Atendimento com horário marcado, das 08:00 às 18:00",

        // Serviços. "preco" é opcional: deixe vazio ("") para não exibir.
        // O campo "nome" é gravado no banco (coluna procedimento).
        servicos: [
            { nome: "Lavagem Premium", desc: "Lavagem técnica detalhada, com secagem cuidadosa e acabamento sem marcas.", preco: "" },
            { nome: "Higienização Interna", desc: "Limpeza profunda de bancos, carpetes, painel e teto, com remoção de odores.", preco: "" },
            { nome: "Polimento", desc: "Correção de riscos e marcas finas para devolver brilho e profundidade à pintura.", preco: "" },
            { nome: "Proteção e Coating Cerâmico", desc: "Camada de proteção de longa duração contra sol, chuva e contaminantes.", preco: "" },
            { nome: "Hidratação de Couro", desc: "Limpeza e condicionamento do couro para manter maciez e evitar ressecamento.", preco: "" },
            { nome: "Detalhamento Completo", desc: "Interna, externa e pintura em um único processo, do começo ao fim.", preco: "" }
        ],

        // Fotos reais da MARGEM AUTO. Coloque os arquivos em /assets e escreva o nome aqui.
        // Enquanto estiver vazio, o site mostra espaços reservados com a marca.
        // Coloque as fotos em /assets e escreva o nome do arquivo aqui.
        // Vazio = o site mostra um espaço reservado com a marca.
        imagens: {
            hero: "../assets/Lavagem Noturna de BMW Preto.png",
            sobre: ["etapa.jpg", "secundaria.jpg"],
            galeria: []      // até 7 fotos, ex.: ["g1.jpg", "g2.jpg", ...]
        },
        galeriaQtd: 7,
        diasNaFaixa: 14,

        // Horários de atendimento (mesma lista usada em agendamento.js)
        horarios: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],

        // Área do cliente: antecedência mínima (em horas) para cancelar/remarcar.
        // O banco também aplica esta regra: se mudar aqui, mude em database/supabase-area-cliente.sql.
        antecedenciaHoras: 2
    };
