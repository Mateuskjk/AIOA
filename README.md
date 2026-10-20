# AIOA

Plataforma B2B de chamados (tickets) para o suporte dos sistemas **LexFlow, LexÁgile, LexHub, LexPré e LexChat**.
Protótipo funcional para validação com os primeiros clientes: Nicolas Gomes Advogado, Luis Albert Advogado (AM e RJ) e LexFinance.

## Rodando

```bash
npm install
npm start
```

Abra http://localhost:4200. O painel da equipe abre em `/dashboard`; o portal do cliente em `/portal`.

```bash
npm test        # testes (Vitest)
npm run build   # build de produção em dist/
```

## O que tem

**Painel da equipe AIOA**: Dashboard, Inbox (mensagens diretas), Notificações, Tickets, Histórico de tickets
(transcrições), Fórum, Base de conhecimento e Clientes. Na tela do ticket: conversa com notas internas,
anexos, emoji, áudio, ligação/vídeo e painel lateral (detalhes, atividade, base, fórum, report, conversas do cliente).

**Portal do cliente**: login simulado por empresa, Meus chamados, Abrir chamado (com sugestões da base de
conhecimento) e conversa do chamado, sem as notas internas.

## Backend (Supabase)

Sem configuração, o app roda em **modo demonstração** (dados no `localStorage`, login simulado).
Com o Supabase configurado, empresas, membros, tickets, mensagens, eventos e transcrições vão para o
banco; anexos e transcrições completas (.txt e .html) vão para o Storage; o login passa a ser real
(e-mail + senha e Google).

Quem acessa o quê é decidido pelo e-mail de quem entra (regras RLS no banco):

- e-mail na tabela `staff` → **Membro Tech**: vê e edita tudo;
- e-mail na tabela `members` → **Usuário** da empresa: vê só a própria empresa e nunca as notas internas;
- qualquer outro e-mail entra, mas não vê nada (a tela de login avisa).

### Configurar

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `supabase/migrations/20261019000000_core.sql` (tabelas, regras, buckets).
3. Ainda no SQL Editor, rode `supabase/seed.sql` (dados de exemplo; gere de novo com `npx tsx scripts/seed-supabase.ts`).
4. Cadastre a equipe na tabela `staff` com os e-mails reais:
   `insert into staff (email, name) values ('voce@lexgroup.com.br', 'Seu Nome');`
   e os clientes em Clientes › empresa › Novo membro (ou na tabela `members`).
5. Em **Project Settings › API**, copie a *Project URL* e a chave *anon/publishable* para
   `src/app/supabase.config.ts`. Essa chave é feita para o navegador; o que cada um pode ler ou gravar é garantido pelas regras do banco.
6. Em **Authentication › URL Configuration**, adicione `http://localhost:4200/login` (e o domínio de produção) em *Redirect URLs*.
7. Google: crie um *OAuth Client ID* (Web) no Google Cloud com o redirect
   `https://<seu-projeto>.supabase.co/auth/v1/callback` e cole o Client ID e o Secret em **Authentication › Providers › Google**.

No primeiro acesso por e-mail, a pessoa usa **Primeiro acesso** na tela de login para criar a senha
(o Supabase envia um e-mail de confirmação). Pelo Google, basta entrar.

## Limites do protótipo

- Sem o Supabase configurado, os dados ficam no `localStorage` e o login é simulado.
- Fórum, base de conhecimento, inbox, notificações e preferências ainda ficam no navegador (próxima etapa).
- Ligação/vídeo usam câmera e microfone locais; conectar o cliente exige um serviço WebRTC.
- Anexos limitados a 2 MB por arquivo.

## Estrutura

```
src/app/
  data.ts        modelo, dados de exemplo e Store (signals + localStorage)
  backend.ts     Supabase: login, carga, tempo real e gravação do núcleo
  supabase.config.ts  URL e chave pública do projeto Supabase
  ui.ts          ícones e logo
  composer.ts    anexos, emoji e áudio
  call.ts        ligação e chamada de vídeo
  portal.ts      portal do cliente
  pages/         telas do painel da equipe
src/styles.scss  tokens da marca e estilos
supabase/        migração (tabelas, RLS, Storage) e seed
scripts/         gerador do seed a partir dos dados de exemplo
```

Angular 22, componentes standalone com signals, sem bibliotecas de UI.
