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
(transcrições), Fórum, Report, Base de conhecimento e Clientes. Na tela do ticket: conversa com notas internas,
anexos, emoji, áudio, ligação/vídeo e painel lateral (detalhes, atividade, base, fórum, report, conversas do cliente).

**Portal do cliente**: login simulado por empresa, Meus chamados, Abrir chamado (com sugestões da base de
conhecimento) e conversa do chamado, sem as notas internas.

## Limites do protótipo

- Não há backend: os dados ficam no `localStorage` do navegador (Configurações › Restaurar dados de exemplo).
- Login do portal é simulado; o isolamento entre empresas é feito no front.
- Ligação/vídeo usam câmera e microfone locais; conectar o cliente exige um serviço WebRTC.
- Anexos limitados a 2 MB por arquivo.

## Estrutura

```
src/app/
  data.ts        modelo, dados de exemplo e Store (signals + localStorage)
  ui.ts          ícones e logo
  composer.ts    anexos, emoji e áudio
  call.ts        ligação e chamada de vídeo
  portal.ts      portal do cliente
  pages/         telas do painel da equipe
src/styles.scss  tokens da marca e estilos
```

Angular 22, componentes standalone com signals, sem bibliotecas de UI.
