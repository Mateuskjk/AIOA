import { Injectable, computed, effect, signal } from '@angular/core';

export const SYSTEMS = ['LexFlow', 'LexÁgile', 'LexHub', 'LexPré', 'LexChat', 'Outros'] as const;
export const COMPANIES = [
  'Nicolas Gomes Advogado',
  'Luis Albert Advogado - AM',
  'Luis Albert Advogado - RJ',
  'LexFinance',
] as const;
export const STATUSES = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fechado'] as const;
export const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const;
export const AGENTS = ['Mateus Silva', 'Ana Rocha', 'Bruno Lima'];
export const CHANNELS = ['WhatsApp', 'E-mail', 'Portal'] as const;

export type System = (typeof SYSTEMS)[number];
export type Company = (typeof COMPANIES)[number];
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Channel = (typeof CHANNELS)[number];

export interface Message {
  author: string;
  body: string;
  at: number;
  via?: Channel;
  files?: Attachment[];
  internal?: boolean;
}
/** File, image or voice note stored inline as a data URL. */
export interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
}
export interface Task {
  text: string;
  done: boolean;
}
export interface LogEntry {
  at: number;
  text: string;
}
export interface Ticket {
  id: number;
  title: string;
  description: string;
  company: Company;
  system: System;
  priority: Priority;
  status: Status;
  assignee: string | null;
  requester: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  pinned: boolean;
  messages: Message[];
  tasks: Task[];
  log: LogEntry[];
}
export interface Topic {
  id: number;
  title: string;
  system: System;
  author: string;
  at: number;
  replies: Message[];
}
export interface Article {
  id: number;
  title: string;
  system: System;
  summary: string;
  body: string;
  author: string;
  updatedAt: number;
  views: number;
}
export interface Notice {
  id: number;
  ticketId: number;
  text: string;
  at: number;
  read: boolean;
}
export interface Conversation {
  id: number;
  with: string;
  org: string;
  unread: number;
  messages: Message[];
}
/** Archived full conversation of a resolved ticket. */
export interface Transcript {
  id: number;
  ticketId: number;
  code: string;
  title: string;
  company: Company;
  system: System;
  requester: string;
  assignee: string | null;
  at: number;
  by: string;
  text: string;
}
/** Who is signed in to the customer portal (simulated login). */
export interface PortalUser {
  name: string;
  company: Company;
}
export interface User {
  name: string;
  role: string;
}

const H = 3600e3;
export const SLA_HOURS: Record<Priority, number> = { Baixa: 72, Média: 24, Alta: 8, Urgente: 4 };
/** Public ticket code, e.g. A-007. */
export const code = (t: Pick<Ticket, 'id'>) => 'A-' + String(t.id).padStart(3, '0');
export const isClosed = (t: Ticket) => t.status === 'Resolvido' || t.status === 'Fechado';

export function sla(t: Ticket): { label: string; late: boolean } {
  const due = t.createdAt + SLA_HOURS[t.priority] * H;
  if (isClosed(t)) {
    const ok = (t.resolvedAt ?? t.updatedAt) <= due;
    return { label: ok ? 'Cumprido' : 'Violado', late: !ok };
  }
  const left = Math.round((due - Date.now()) / H);
  return left < 0 ? { label: `Atrasado ${-left} h`, late: true } : { label: `Restam ${left} h`, late: false };
}

export function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60e3);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
}

export const fmt = (ts: number) =>
  new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Full plain-text transcript of a ticket: every message (notes included), event and attachment, in order. */
export function transcript(t: Ticket, generatedAt = Date.now()): string {
  const when = (ts: number) => new Date(ts).toLocaleString('pt-BR');
  const entries = [
    ...t.log.map((l) => ({ at: l.at, text: `[${when(l.at)}] — ${l.text}` })),
    ...t.messages.map((m) => {
      const who = m.internal ? `${m.author} [NOTA INTERNA]` : m.via ? `${m.author} (via ${m.via})` : m.author;
      const files = (m.files ?? []).map((f) => `\n  📎 Anexo: ${f.name}`).join('');
      return { at: m.at, text: `[${when(m.at)}] ${who}:\n${m.body || '(sem texto)'}${files}` };
    }),
  ].sort((a, b) => a.at - b.at);
  return [
    `TRANSCRIÇÃO DO CHAMADO ${code(t)}`,
    `Título: ${t.title}`,
    `Empresa: ${t.company} | Sistema: ${t.system}`,
    `Solicitante: ${t.requester} | Responsável: ${t.assignee ?? 'Sem responsável'}`,
    `Prioridade: ${t.priority} | Aberto em: ${when(t.createdAt)}`,
    `Descrição: ${t.description}`,
    `Gerada em: ${when(generatedAt)}`,
    '='.repeat(60),
    '',
    entries.map((e) => e.text).join('\n\n'),
    '',
    '='.repeat(60),
    `Fim da transcrição — ${t.messages.length} mensagens, ${t.log.length} eventos.`,
  ].join('\n');
}

export const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** CSS class for status/priority badges, e.g. "Em andamento" -> "b-em-andamento". */
export const badge = (s: string) =>
  'badge b-' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

export const CUSTOMERS: Record<Company, { contact: string; email: string; phone: string; city: string; since: string; systems: System[] }> = {
  'Nicolas Gomes Advogado': { contact: 'Nicolas Gomes', email: 'contato@nicolasgomes.exemplo.com', phone: '(11) 4000-1001', city: 'São Paulo - SP', since: 'mar/2024', systems: ['LexFlow', 'LexÁgile', 'LexHub', 'LexChat'] },
  'Luis Albert Advogado - AM': { contact: 'Luis Albert', email: 'am@luisalbert.exemplo.com', phone: '(92) 4000-2002', city: 'Manaus - AM', since: 'ago/2024', systems: ['LexHub', 'LexÁgile'] },
  'Luis Albert Advogado - RJ': { contact: 'Luis Albert', email: 'rj@luisalbert.exemplo.com', phone: '(21) 4000-3003', city: 'Rio de Janeiro - RJ', since: 'ago/2024', systems: ['LexFlow', 'LexChat', 'LexPré'] },
  LexFinance: { contact: 'Carla', email: 'suporte@lexfinance.exemplo.com', phone: '(11) 4000-4004', city: 'São Paulo - SP', since: 'jan/2025', systems: ['LexFlow', 'LexÁgile', 'LexHub', 'LexPré', 'LexChat'] },
};

const CONTACTS: Record<Company, string> = {
  'Nicolas Gomes Advogado': 'Nicolas Gomes',
  'Luis Albert Advogado - AM': 'Luis Albert (AM)',
  'Luis Albert Advogado - RJ': 'Luis Albert (RJ)',
  LexFinance: 'Carla — LexFinance',
};

/** Everyone you can DM: the support team plus each customer's contact. */
export const PEOPLE = [
  ...AGENTS.map((name) => ({ name, org: 'Equipe AIOA' })),
  ...COMPANIES.map((c) => ({ name: CONTACTS[c], org: c as string })),
];

const SEED: [string, System, Company, Priority, Status, number][] = [
  ['Erro ao gerar petição no fluxo de contencioso', 'LexFlow', 'Nicolas Gomes Advogado', 'Alta', 'Aberto', 2],
  ['Sprint não aparece no quadro kanban', 'LexÁgile', 'LexFinance', 'Média', 'Em andamento', 20],
  ['Integração com o PJe retornando timeout', 'LexHub', 'Luis Albert Advogado - AM', 'Urgente', 'Aberto', 5],
  ['Pré-análise com valores divergentes', 'LexPré', 'LexFinance', 'Alta', 'Em andamento', 30],
  ['Bot do WhatsApp não responde fora do horário', 'LexChat', 'Luis Albert Advogado - RJ', 'Média', 'Aguardando cliente', 48],
  ['Solicitação de novo usuário', 'Outros', 'Nicolas Gomes Advogado', 'Baixa', 'Resolvido', 96],
  ['Prazo duplicado na agenda', 'LexFlow', 'Luis Albert Advogado - RJ', 'Média', 'Aberto', 10],
  ['Lentidão ao abrir processos', 'LexHub', 'Nicolas Gomes Advogado', 'Alta', 'Resolvido', 120],
  ['Exportação de relatório em PDF quebrada', 'LexÁgile', 'Luis Albert Advogado - AM', 'Baixa', 'Aberto', 60],
  ['Histórico de conversas sumiu', 'LexChat', 'LexFinance', 'Alta', 'Em andamento', 7],
  ['Importação de planilha de clientes', 'LexPré', 'Luis Albert Advogado - RJ', 'Média', 'Fechado', 200],
  ['Impressora do escritório não conecta', 'Outros', 'Luis Albert Advogado - AM', 'Baixa', 'Aguardando cliente', 26],
  ['Notificações por e-mail não chegam', 'LexFlow', 'LexFinance', 'Média', 'Resolvido', 150],
  ['Permissão negada ao editar tarefa', 'LexÁgile', 'Nicolas Gomes Advogado', 'Alta', 'Aberto', 1],
  ['Transferência de atendimento entre agentes', 'LexChat', 'Nicolas Gomes Advogado', 'Média', 'Resolvido', 80],
  ['Certificado digital expirado no LexHub', 'LexHub', 'LexFinance', 'Urgente', 'Em andamento', 3],
];

function seed() {
  const now = Date.now();
  const tickets: Ticket[] = SEED.map(([title, system, company, priority, status, hrs], i) => {
    const createdAt = now - hrs * H;
    const closed = status === 'Resolvido' || status === 'Fechado';
    const assignee = status === 'Aberto' && i % 2 ? null : AGENTS[i % AGENTS.length];
    const via = CHANNELS[i % CHANNELS.length];
    const requester = CONTACTS[company];
    const doneAt = Math.min(now - H, createdAt + SLA_HOURS[priority] * (i % 5 ? 0.6 : 1.5) * H); // most within SLA, some violated
    const description = `Olá, estamos com o seguinte problema: ${title.toLowerCase()}. Poderiam verificar com urgência?`;
    const messages: Message[] = [{ author: requester, body: description, at: createdAt, via }];
    const log: LogEntry[] = [{ at: createdAt, text: `${requester} abriu o chamado via ${via}` }];
    if (assignee) {
      log.push({ at: createdAt + 0.4 * H, text: `Chamado atribuído a ${assignee}` });
      messages.push({ author: assignee, body: 'Recebido! Já estamos analisando e retornamos em breve.', at: createdAt + 0.5 * H, via });
      messages.push({ author: requester, body: 'Obrigado, fico no aguardo.', at: createdAt + 0.55 * H, via });
    }
    if (closed) {
      messages.push({ author: assignee ?? AGENTS[0], body: 'Ajuste aplicado em produção. Pode validar, por favor?', at: doneAt, via });
      log.push({ at: doneAt, text: `Status alterado para ${status}` });
    }
    return {
      id: i + 1, title, description, system, company, priority, status, assignee, createdAt, requester, log,
      updatedAt: messages[messages.length - 1].at,
      resolvedAt: closed ? doneAt : undefined,
      pinned: i === 2 || i === 15,
      messages,
      tasks: assignee
        ? [{ text: 'Reproduzir o problema em homologação', done: true }, { text: 'Aplicar correção', done: closed }, { text: 'Validar com o cliente', done: closed }]
        : [],
    };
  });
  const topics: Topic[] = [
    { id: 1, title: 'Como configurar regras de distribuição de prazos no LexFlow?', system: 'LexFlow', author: 'Nicolas Gomes', at: now - 50 * H,
      replies: [{ author: 'Ana Rocha', body: 'Em Configurações › Fluxos › Prazos você define a regra por tipo de processo.', at: now - 46 * H }] },
    { id: 2, title: 'Boas práticas para respostas automáticas no LexChat', system: 'LexChat', author: 'Carla — LexFinance', at: now - 30 * H, replies: [] },
    { id: 3, title: 'Atalhos de teclado no quadro do LexÁgile', system: 'LexÁgile', author: 'Bruno Lima', at: now - 8 * H,
      replies: [{ author: 'Luis Albert (RJ)', body: 'Muito útil, obrigado!', at: now - 6 * H }] },
  ];
  const notices: Notice[] = [
    { id: 1, ticketId: 14, text: 'Novo chamado A-014 aberto por Nicolas Gomes', at: now - 1 * H, read: false },
    { id: 2, ticketId: 3, text: 'Chamado A-003 está perto de estourar o SLA', at: now - 1.5 * H, read: false },
    { id: 3, ticketId: 1, text: 'Novo chamado A-001 aberto por Nicolas Gomes', at: now - 2 * H, read: false },
    { id: 4, ticketId: 5, text: 'Luis Albert (RJ) respondeu o chamado A-005', at: now - 20 * H, read: true },
  ];
  const D = 24 * H;
  const articles: Article[] = [
    { id: 1, system: 'LexHub', author: 'Ana Rocha', updatedAt: now - 3 * D, views: 128,
      title: 'Como renovar o certificado digital no LexHub',
      summary: 'Passo a passo para instalar o novo certificado A1/A3 e evitar falhas de integração com os tribunais.',
      body: '1. Acesse Configurações › Integrações › Certificados.\n2. Clique em "Adicionar certificado" e selecione o arquivo .pfx (A1) ou conecte o token (A3).\n3. Informe a senha do certificado e salve.\n4. Marque o novo certificado como padrão e remova o antigo.\n5. Clique em "Testar conexão" para validar com PJe e e-SAJ.\n\nSe o teste falhar, confira se a data e a hora do computador estão corretas.' },
    { id: 2, system: 'LexHub', author: 'Bruno Lima', updatedAt: now - 6 * D, views: 74,
      title: 'Integração com o PJe retornando timeout',
      summary: 'O que verificar quando as consultas ao PJe demoram ou não retornam.',
      body: 'O timeout normalmente acontece por instabilidade do tribunal ou por certificado expirado.\n\n1. Verifique a página de status do tribunal.\n2. Confira a validade do certificado (veja o artigo "Como renovar o certificado digital no LexHub").\n3. Reduza o lote de consultas em Integrações › PJe › Lote máximo para 50.\n\nSe persistir por mais de 1 hora, abra um chamado com prioridade Alta.' },
    { id: 3, system: 'LexFlow', author: 'Ana Rocha', updatedAt: now - 10 * D, views: 96,
      title: 'Configurando regras de distribuição de prazos',
      summary: 'Defina quem recebe cada prazo automaticamente por tipo de processo e área.',
      body: '1. Acesse Configurações › Fluxos › Prazos.\n2. Clique em "Nova regra".\n3. Escolha o tipo de processo, a área e o responsável (pessoa ou equipe).\n4. Defina a antecedência do alerta (padrão: 3 dias úteis).\n5. Salve e ative a regra.\n\nAs regras são avaliadas de cima para baixo; arraste para mudar a prioridade.' },
    { id: 4, system: 'LexChat', author: 'Mateus Silva', updatedAt: now - 2 * D, views: 51,
      title: 'Horário de atendimento e respostas automáticas no WhatsApp',
      summary: 'Configure a mensagem fora do horário e evite que o bot fique sem responder.',
      body: '1. Acesse LexChat › Canais › WhatsApp › Horários.\n2. Defina os dias e horários de atendimento.\n3. Em "Fora do horário", ative a resposta automática e escreva a mensagem.\n4. Salve e envie uma mensagem de teste fora do horário configurado.' },
    { id: 5, system: 'LexÁgile', author: 'Bruno Lima', updatedAt: now - 15 * D, views: 39,
      title: 'Permissões de usuários no quadro kanban',
      summary: 'Entenda os perfis Leitor, Membro e Gestor e como liberar a edição de tarefas.',
      body: 'Perfis disponíveis:\n• Leitor: apenas visualiza o quadro.\n• Membro: cria e edita as próprias tarefas.\n• Gestor: edita qualquer tarefa e gerencia sprints.\n\nPara alterar: Projeto › Membros › clique no usuário › Perfil.' },
    { id: 6, system: 'LexPré', author: 'Ana Rocha', updatedAt: now - 20 * D, views: 22,
      title: 'Importando planilha de clientes',
      summary: 'Formato aceito, colunas obrigatórias e como corrigir erros de importação.',
      body: 'Formatos aceitos: .xlsx e .csv (separado por ponto e vírgula).\n\nColunas obrigatórias: Nome, CPF/CNPJ, E-mail.\n\n1. Acesse Clientes › Importar.\n2. Baixe o modelo e preencha.\n3. Envie o arquivo e revise a pré-visualização.\n4. Linhas com erro aparecem em vermelho; corrija e reenvie só essas linhas.' },
  ];
  const dm = (author: string, body: string, minsAgo: number): Message => ({ author, body, at: now - minsAgo * 60e3 });
  const conversations: Conversation[] = [
    { id: 1, with: 'Ana Rocha', org: 'Equipe AIOA', unread: 2, messages: [
      dm('Mateus Silva', 'Ana, consegue cobrir o plantão de sábado?', 95),
      dm('Ana Rocha', 'Consigo sim!', 40),
      dm('Ana Rocha', 'Só me passa os chamados urgentes em aberto antes de sair 🙏', 38) ] },
    { id: 2, with: 'Nicolas Gomes', org: 'Nicolas Gomes Advogado', unread: 1, messages: [
      dm('Nicolas Gomes', 'Bom dia! Vocês têm previsão para a nova versão do LexFlow?', 180),
      dm('Mateus Silva', 'Bom dia, Nicolas! Está prevista para o fim do mês, te aviso assim que sair.', 170),
      dm('Nicolas Gomes', 'Perfeito, obrigado. Podemos agendar um treinamento para a equipe?', 25) ] },
    { id: 3, with: 'Bruno Lima', org: 'Equipe AIOA', unread: 0, messages: [
      dm('Bruno Lima', 'Subi a correção do PJe em homologação.', 1500),
      dm('Mateus Silva', 'Valeu! Vou testar com o cliente do AM.', 1490) ] },
    { id: 4, with: 'Carla — LexFinance', org: 'LexFinance', unread: 0, messages: [
      dm('Carla — LexFinance', 'Recebemos a fatura, obrigada!', 4300) ] },
  ];
  const transcripts = tickets.filter(isClosed).map((t) => toTranscript(t, t.assignee ?? AGENTS[0], t.resolvedAt ?? t.updatedAt));
  return { tickets, topics, notices, articles, conversations, transcripts, portalUser: null as PortalUser | null, user: { name: 'Mateus Silva', role: 'Analista de suporte' } as User };
}

function toTranscript(t: Ticket, by: string, at = Date.now()): Transcript {
  return {
    id: at + t.id, ticketId: t.id, code: code(t), title: t.title, company: t.company, system: t.system,
    requester: t.requester, assignee: t.assignee, at, by, text: transcript(t, at),
  };
}

const KEY = 'aioa:v3';
// ponytail: localStorage is the whole backend; swap for an HTTP API when the prototype is validated.
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly db = signal(this.load());
  readonly tickets = computed(() => this.db().tickets);
  readonly topics = computed(() => this.db().topics);
  readonly notices = computed(() => this.db().notices);
  readonly articles = computed(() => this.db().articles);
  readonly conversations = computed(() =>
    [...this.db().conversations].sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0)),
  );
  readonly unreadDms = computed(() => this.db().conversations.reduce((n, c) => n + c.unread, 0));
  readonly transcripts = computed(() => [...this.db().transcripts].sort((a, b) => b.at - a.at));
  readonly portalUser = computed(() => this.db().portalUser);
  readonly user = computed(() => this.db().user);
  readonly pinned = computed(() => this.tickets().filter((t) => t.pinned));
  readonly unread = computed(() => this.notices().filter((n) => !n.read).length);

  constructor() {
    effect(() => {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.db()));
      } catch {
        // ponytail: attachments live in localStorage (~5 MB); move files to object storage with the real backend.
        alert('O armazenamento do protótipo está cheio. Remova anexos ou restaure os dados de exemplo em Configurações.');
      }
    });
  }

  private load(): ReturnType<typeof seed> {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
      if (raw) return { ...seed(), ...JSON.parse(raw) }; // new collections get seeded, saved ones win
    } catch {}
    return seed();
  }

  reset() {
    this.db.set(seed());
  }

  ticket(id: number) {
    return this.tickets().find((t) => t.id === id);
  }

  createTicket(d: Pick<Ticket, 'title' | 'description' | 'company' | 'system' | 'priority' | 'requester'> & { via: Channel; files?: Attachment[] }) {
    const now = Date.now();
    const id = Math.max(0, ...this.tickets().map((t) => t.id)) + 1;
    const { via, files, ...rest } = d;
    const t: Ticket = {
      ...rest, id, status: 'Aberto', assignee: null, createdAt: now, updatedAt: now, pinned: false, tasks: [],
      messages: [{ author: d.requester, body: d.description, at: now, via, files }],
      log: [{ at: now, text: `${d.requester} abriu o chamado via ${via}` }],
    };
    this.db.update((db) => ({
      ...db,
      tickets: [t, ...db.tickets],
      notices: [{ id: now, ticketId: id, text: `Novo chamado ${code(t)} aberto por ${d.requester}`, at: now, read: false }, ...db.notices],
    }));
    return id;
  }

  /** Patches a ticket; status/priority/assignee changes are written to its activity log. */
  updateTicket(id: number, patch: Partial<Ticket>) {
    const now = Date.now();
    const who = this.user().name;
    this.db.update((db) => ({
      ...db,
      tickets: db.tickets.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch, updatedAt: now };
        const log = [...(patch.log ?? t.log)];
        if (patch.status && patch.status !== t.status) {
          next.resolvedAt = isClosed(next) ? (t.resolvedAt ?? now) : undefined;
          log.push({ at: now, text: `${who} alterou o status para ${patch.status}` });
        }
        if (patch.priority && patch.priority !== t.priority) log.push({ at: now, text: `${who} alterou a prioridade para ${patch.priority}` });
        if ('assignee' in patch && patch.assignee !== t.assignee)
          log.push({ at: now, text: patch.assignee ? `Chamado atribuído a ${patch.assignee}` : 'Responsável removido' });
        next.log = log;
        return next;
      }),
    }));
  }

  portalLogin(user: PortalUser | null) {
    this.db.update((db) => ({ ...db, portalUser: user }));
  }

  /**
   * A customer's reply from the portal: waiting tickets go back to the team,
   * resolved ones reopen, and the agents get a notification.
   */
  customerReply(id: number, body: string, files: Attachment[] = []) {
    const t = this.ticket(id);
    const who = this.portalUser()?.name ?? t?.requester;
    if (!t || !who) return;
    const now = Date.now();
    const status: Status = t.status === 'Aguardando cliente' ? 'Em andamento' : isClosed(t) ? 'Aberto' : t.status;
    const log = status === t.status ? t.log : [...t.log, { at: now, text: `${who} respondeu e o chamado voltou para ${status}` }];
    this.db.update((db) => ({
      ...db,
      tickets: db.tickets.map((x) =>
        x.id === id
          ? { ...x, status, log, updatedAt: now, resolvedAt: status === 'Aberto' ? undefined : x.resolvedAt,
              messages: [...x.messages, { author: who, body, at: now, via: 'Portal' as Channel, files }] }
          : x,
      ),
      notices: [{ id: now, ticketId: id, text: `${who} respondeu o chamado ${code(t)}`, at: now, read: false }, ...db.notices],
    }));
  }

  /** Adds a free-form entry to the ticket's activity log (shown in the conversation timeline). */
  logEvent(id: number, text: string) {
    const t = this.ticket(id);
    if (t) this.updateTicket(id, { log: [...t.log, { at: Date.now(), text }] });
  }

  reply(id: number, body: string, via: Channel, internal = false, files: Attachment[] = []) {
    const t = this.ticket(id);
    if (t) this.updateTicket(id, { messages: [...t.messages, { author: this.user().name, body, at: Date.now(), via, internal, files }] });
  }

  markRead(id?: number) {
    this.db.update((db) => ({ ...db, notices: db.notices.map((n) => (id == null || n.id === id ? { ...n, read: true } : n)) }));
  }

  createTopic(title: string, system: System, body: string) {
    const now = Date.now();
    const author = this.user().name;
    this.db.update((db) => ({
      ...db,
      topics: [{ id: now, title, system, author, at: now, replies: body ? [{ author, body, at: now }] : [] }, ...db.topics],
    }));
  }

  replyTopic(id: number, body: string) {
    const r = { author: this.user().name, body, at: Date.now() };
    this.db.update((db) => ({ ...db, topics: db.topics.map((t) => (t.id === id ? { ...t, replies: [...t.replies, r] } : t)) }));
  }

  createArticle(d: Pick<Article, 'title' | 'system' | 'summary' | 'body'>) {
    const now = Date.now();
    this.db.update((db) => ({ ...db, articles: [{ ...d, id: now, author: this.user().name, updatedAt: now, views: 0 }, ...db.articles] }));
  }

  viewArticle(id: number) {
    this.db.update((db) => ({ ...db, articles: db.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)) }));
  }

  /** Opens (or creates) the DM thread with someone and returns its id. */
  startDm(name: string, org: string) {
    const found = this.db().conversations.find((c) => c.with === name);
    if (found) return found.id;
    const id = Date.now();
    this.db.update((db) => ({ ...db, conversations: [...db.conversations, { id, with: name, org, unread: 0, messages: [] }] }));
    return id;
  }

  readDm(id: number) {
    this.db.update((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)) }));
  }

  sendDm(id: number, body: string, files: Attachment[] = []) {
    const m = { author: this.user().name, body, at: Date.now(), files };
    this.db.update((db) => ({ ...db, conversations: db.conversations.map((c) => (c.id === id ? { ...c, messages: [...c.messages, m] } : c)) }));
  }

  /** Archives the ticket's current full transcript in Histórico de tickets and returns it. */
  saveTranscript(ticketId: number) {
    const tr = toTranscript(this.ticket(ticketId)!, this.user().name);
    this.db.update((db) => ({ ...db, transcripts: [tr, ...db.transcripts] }));
    return tr;
  }

  setUser(user: User) {
    this.db.update((db) => ({ ...db, user }));
  }
}
