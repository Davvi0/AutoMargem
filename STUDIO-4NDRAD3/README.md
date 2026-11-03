# Studio 4ndrad3 — Site + Agendamento + Painel

Redesign do site público (preto, branco e cinza) sobre o sistema existente.
A lógica de agendamento (Supabase, horários ocupados, validação, confirmação, WhatsApp) é a original.

## Estrutura (resumo)
- `public/` — site e agendamento do cliente (`index.html`, `style.css`, `landing.js`, `agendamento.js`)
- `admin/` — login (`admin/login/login.html`) e painel (`admin/painel.html`)
- `assets/` — logo, favicon e fotos
- `database/` — SQL de segurança do Supabase
- `shared/` — referência de configuração

## Como personalizar
Tudo do site público fica em `public/config-site.js`:
- **Serviços**: `servicos` (nome, descrição, preço opcional). O nome é o valor gravado no banco. Os preços reais vêm da aba Preços do painel.
- **Contato**: `whatsapp`, `instagram`, `maps`, `endereco`, `horario`.
- **Fotos**: coloque os arquivos em `assets/` e escreva o nome em `imagens` (hero, sobre, galeria).
  Enquanto estiver vazio, o site mostra espaços reservados com a marca.

O WhatsApp também existe em `public/agendamento.js` (`WHATSAPP_SALAO`) e os horários em `horariosDisponiveis`.
Credenciais do Supabase: `public/agendamento.js`, `admin/core.js`, `admin/login/login.js`.

## Rodar
Abra `public/index.html` (ou sirva a pasta com qualquer servidor estático).

## Área do cliente (login) — `public/cliente.html`
Clientes criam conta com e-mail e senha (Supabase Auth), veem os próprios horários, **remarcam**,
**cancelam**, baixam o evento para o calendário, editam nome/WhatsApp e trocam a senha.
Agendamentos feitos **logado** ficam vinculados à conta automaticamente. Visitante sem login continua podendo agendar.

### Para ativar (uma vez)
1. Supabase > SQL Editor: rode `database/supabase-seguranca.sql` (se ainda não rodou) e depois
   `database/supabase-area-cliente.sql`.
2. Supabase > Authentication:
   - **Sign In / Providers > Email**: mantenha **"Allow new users to sign up" LIGADO** (clientes precisam criar conta).
     O painel admin continua protegido pelo e-mail da dona.
   - **"Confirm email"**: ligado = cliente confirma o e-mail antes de entrar (recomendado); desligado = entra na hora.
   - **URL Configuration**: em *Site URL* e *Redirect URLs* coloque o endereço público de `cliente.html`
     (usado nos e-mails de confirmação e de recuperação de senha).
3. (Opcional) Personalize os textos dos e-mails em Authentication > Email Templates.

### Regras
- Cancelar/remarcar com no mínimo **2 horas** de antecedência (`antecedenciaHoras` em `public/config-site.js`
  e `interval '2 hours'` nas funções do SQL — mantenha os dois iguais).
- Cancelar grava `status = 'cancelado'`; o painel admin já mostra.
- Só aparecem na área do cliente os agendamentos feitos **depois** de ele estar logado.

## Preços e valores (aba "Preços" do painel) — histórico
- O valor dos atendimentos **só é editado na aba Preços**. Não existe mais "Editar valor" na agenda nem campo de valor no novo agendamento.
- Ao salvar um preço novo, todos os agendamentos **confirmados daquele serviço que ainda vão acontecer** (a partir do momento do salvamento) recebem o novo valor. Atendimentos que já passaram mantêm o valor antigo.
- Agendamentos novos (site, área do cliente ou painel) já nascem com o preço vigente; remarcar para outro serviço troca o valor.
- Financeiro e Dashboard somam o valor dos agendamentos (cancelados e faltas não entram).
- **Para ativar:** rode `database/supabase-precos.sql` no SQL Editor do Supabase (depois de `supabase-seguranca.sql`). O nome do serviço no agendamento deve ser igual ao da tabela de preços.


## Sem profissionais (agenda única) — ATUAL

Na MARGEM AUTO o cliente não escolhe profissional. O agendamento tem 5 passos
(Serviço, Data, Horário, Dados, Confirmar), a agenda do painel é uma só e cada serviço
tem **um único preço**, definido na aba Preços (tabela `servicos_precos`).

**Para ativar:** rode `database/supabase-sem-profissionais.sql` no SQL Editor do Supabase
(depois de todos os scripts anteriores). Ele não apaga dados:

- copia os preços de `servicos_profissionais` para `servicos_precos` (se um serviço tinha
  preços diferentes por profissional, fica o **menor**; confira na aba Preços);
- só permite 1 agendamento confirmado por dia + horário;
- troca `criar_agendamento` para 5 parâmetros e atualiza remarcar, vincular veículo e os gatilhos de valor;
- cria `servicos_catalogo()` e `preco_servico()` para o site público.

Agendamentos antigos mantêm a coluna `profissional` só como histórico (não aparece mais).
O valor gravado em cada agendamento continua congelado: mudar preço só afeta os novos.

**Descrição dos serviços:** rode também `database/supabase-descricao-servicos.sql`. Depois disso a aba Preços
tem um campo de descrição por serviço, e a seção "Serviços" do site e o agendamento passam a ler tudo do banco
(serviço novo só aparece no site depois de ter preço e de clicar em "Salvar alterações").

> As seções "Preços e valores" e "V2" abaixo são históricas: a parte de profissionais não vale mais.

## V2 (histórico) — preços por profissional e Clientes

Depois dos scripts existentes de segurança, área do cliente, profissionais e preços,
rode `database/supabase-v2-clientes-precos.sql` no Supabase.

A V2 adiciona, sem apagar os dados existentes:

- preço individual por profissional + serviço;
- disponibilidade de serviços por profissional;
- botão "Aplicar para todos" na aba Preços;
- preço histórico congelado no agendamento;
- preço correto também ao remarcar serviço na área do cliente;
- catálogo público filtrado pelo profissional;
- aba Clientes no admin, consolidada diretamente dos agendamentos;
- pesquisa por nome/WhatsApp, filtros, histórico e botão de WhatsApp.

### Regra de histórico

A partir da V2, salvar um novo preço **não altera agendamentos existentes**.
O preço é definido no momento em que o agendamento é criado e fica salvo na coluna
`agendamentos.valor`. Assim, alterações futuras de preço não mudam o histórico.

A tabela `servicos_precos` anterior é preservada para compatibilidade e para registros
legados. A nova fonte de configuração é `servicos_profissionais`.

### Atualização do banco

O arquivo `supabase-v2-clientes-precos.sql` é uma migração incremental. Ele não apaga
registros e pode ser executado depois das estruturas atuais. Não é necessário recriar o
projeto nem trocar a arquitetura.
