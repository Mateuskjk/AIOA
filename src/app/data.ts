import { Injectable, computed, effect, signal } from '@angular/core';

export const SYSTEMS = ['LexFlow', 'LexÁgile', 'LexHub', 'LexPré', 'LexChat', 'Outros'] as const;
export const COMPANIES = [
  'Nicolas Gomes Advogado',
  'Luis Albert Advogado - AM',
  'Luis Albert Advogado - RJ',
  'LexFinance',
] as const;
export const STATUSES = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fechado', 'Cancelado', 'Reprovado'] as const;
export const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const;
export const AGENTS = ['Mateus Silva', 'Ana Rocha', 'Bruno Lima'];
/** Team e-mails for the simulated sign-in: "Ana Rocha" → ana.rocha@aioa.exemplo.com. */
export const staffEmail = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '.') + '@aioa.exemplo.com';
export const CHANNELS = ['WhatsApp', 'E-mail', 'Portal'] as const;
export const CATEGORIES = {
  Bug: ['Erro de tela', 'Lentidão', 'Integração', 'Dados incorretos'],
  Acesso: ['Novo usuário', 'Permissão', 'Login e senha'],
  Funcionalidade: ['Dúvida de uso', 'Configuração'],
  Melhorias: ['Sugestão', 'Nova funcionalidade'],
  Dashboard: ['Relatório', 'Indicadores'],
  'Suporte de T.I.': ['Equipamento', 'Rede', 'Certificado digital'],
} as const;

export type System = (typeof SYSTEMS)[number];
/** Customer company name. Customers are stored data (see Store.customers); COMPANIES only seeds the demo. */
export type Company = string;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Channel = (typeof CHANNELS)[number];

// ponytail: short descriptions written for the prototype; confirm the copy with each product team.
/** What each system does: shown on the institutional site and when a customer opens a ticket. */
export const SYSTEM_INFO: Record<System, { tag: string; text: string; items: readonly string[] }> = {
  LexFlow: { tag: 'Gestão jurídica', text: 'Publicações, processos, prazos e equipe no mesmo fluxo: do diário oficial à tarefa cumprida.', items: ['Publicações e prazos fatais', 'Processos por CNJ', 'Tarefas e audiências'] },
  'LexÁgile': { tag: 'Gestão ágil', text: 'Projetos e atividades em sprints e quadros, com responsáveis, prazos e movimentações.', items: ['Sprints e quadros', 'Atividades e comentários', 'Acompanhamento da equipe'] },
  LexHub: { tag: 'Dashboards', text: 'A plataforma de dashboards do grupo: indicadores de produtividade, resultados e operação em painéis visuais.', items: ['Painéis e indicadores', 'Produtividade da equipe', 'Relatórios gerenciais'] },
  'LexPré': { tag: 'Gestão de demandas', text: 'Gestão das demandas do início do contrato até o protocolo, com cada etapa, responsável e prazo acompanhados.', items: ['Entrada pelo contrato', 'Etapas e responsáveis', 'Acompanhamento até o protocolo'] },
  LexChat: { tag: 'Atendimento', text: 'Atendimento ao cliente por chat e WhatsApp, com certificados e notificações integrados.', items: ['Chat e WhatsApp', 'Atendimento multicanal', 'Notificações'] },
  Outros: { tag: 'Assuntos gerais', text: 'Dúvidas gerais, acessos ou qualquer assunto que não seja de um sistema específico.', items: ['Acessos e cadastros', 'Dúvidas gerais', 'Sugestões'] },
};
export type Category = keyof typeof CATEGORIES;

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
  category: Category;
  subcategory: string;
  priority: Priority;
  status: Status;
  assignee: string | null;
  /** Agent who finished the ticket (resolved, cancelled or rejected). */
  closedBy?: string;
  requester: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  pinned: boolean;
  messages: Message[];
  tasks: Task[];
  log: LogEntry[];
}
/** One vote per person: +1 (up) or -1 (down). */
export type Votes = Record<string, 1 | -1>;
export const score = (v?: Votes) => Object.values(v ?? {}).reduce<number>((a, b) => a + b, 0);

/** Forum comment; `parent` is the index of the comment it answers (one level of nesting). */
export interface Comment {
  author: string;
  body: string;
  at: number;
  votes?: Votes;
  parent?: number;
}
export interface Topic {
  id: number;
  title: string;
  system: System;
  author: string;
  at: number;
  body?: string;
  votes?: Votes;
  replies: Comment[];
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
  /** Names of the people who liked the article (team or customers). */
  likes?: string[];
}
export interface Notice {
  id: number;
  ticketId: number;
  text: string;
  at: number;
  read: boolean;
}
/** A demo request sent from the institutional site. */
export interface DemoRequest {
  name: string;
  email: string;
  company: string;
  systems: string[];
  message: string;
  at: number;
}
export interface Conversation {
  id: number;
  with: string;
  org: string;
  unread: number;
  messages: Message[];
}
/**
 * Server persistence for the core data (Supabase). The Store keeps working in memory and calls these
 * after each local change; without a backend configured they are never set (demo mode, localStorage).
 */
export interface Remote {
  createTicket(t: Ticket): Promise<number>;
  syncTicket(prev: Ticket, next: Ticket): void;
  saveTranscript(tr: Transcript, t: Ticket): void;
  createCustomer(c: Customer): void;
  addMember(company: Company, m: Member): void;
  removeMember(company: Company, email: string): void;
  setSystems(company: Company, systems: System[]): void;
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
  /** Archived .txt in Storage (server mode). */
  txtPath?: string;
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

/** Team preferences edited in Configurações. `closing` accepts {cliente} and {codigo}. */
export interface Prefs {
  sound: boolean;
  push: boolean;
  closing: string;
  transcriptNote: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  sound: true,
  push: true,
  closing: 'Olá, {cliente}! Seu chamado {codigo} foi resolvido e o atendimento está encerrado. Se precisar, é só abrir um novo chamado. 😊',
  transcriptNote: true,
};

const H = 3600e3;
export const SLA_HOURS: Record<Priority, number> = { Baixa: 72, Média: 24, Alta: 8, Urgente: 4 };
/** Dashboard KPIs. Resolution rate = resolved ÷ finished (resolved + cancelled + rejected). */
export function kpiStats(tickets: Ticket[]) {
  const by = (...st: Status[]) => tickets.filter((t) => st.includes(t.status)).length;
  const resolved = tickets.filter(isResolved);
  const hours = resolved.map((t) => ((t.resolvedAt ?? t.updatedAt) - t.createdAt) / H);
  const cancelled = by('Cancelado');
  const rejected = by('Reprovado');
  const finished = resolved.length + cancelled + rejected;
  return {
    total: tickets.length,
    waiting: by('Aberto'),
    inProgress: by('Em andamento', 'Aguardando cliente'),
    resolved: resolved.length,
    cancelled,
    rejected,
    avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    rate: finished ? Math.round((resolved.length / finished) * 100) : null,
    finished,
  };
}

/** Counts per label, largest first (ties alphabetical); `top` keeps the first N. */
export function countBy(labels: string[], top = Infinity) {
  const m = new Map<string, number>();
  for (const l of labels) m.set(l, (m.get(l) ?? 0) + 1);
  return [...m]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, top);
}

/** Tickets opened in each of the last `months` calendar months, labelled "nov 2025". */
export function monthlyTrend(tickets: Ticket[], now = Date.now(), months = 12) {
  const d = new Date(now);
  return Array.from({ length: months }, (_, k) => {
    const from = new Date(d.getFullYear(), d.getMonth() - (months - 1 - k), 1);
    const to = new Date(d.getFullYear(), d.getMonth() - (months - 2 - k), 1).getTime();
    return {
      label: `${from.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')} ${from.getFullYear()}`,
      opened: tickets.filter((t) => t.createdAt >= from.getTime() && t.createdAt < to).length,
    };
  });
}

/** Resolved tickets per month for each agent over the last `months` months, best first. */
export function perAgentAverage(tickets: Ticket[], now = Date.now(), months = 12) {
  const d = new Date(now);
  const from = new Date(d.getFullYear(), d.getMonth() - (months - 1), 1).getTime();
  const resolved = tickets.filter((t) => isResolved(t) && (t.resolvedAt ?? 0) >= from);
  return countBy(resolved.map((t) => t.closedBy ?? t.assignee ?? '—')).map((r) => ({
    label: r.label,
    value: Math.round((r.value / months) * 100) / 100,
  }));
}

/** 0.5 -> "30 min", 5.25 -> "5 h 15 min", 32.9 -> "33 h", 50 -> "2 d 2 h". */
export function duration(hours: number) {
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 10) return mins % 60 ? `${h} h ${mins % 60} min` : `${h} h`;
  if (h < 48) return `${Math.round(mins / 60)} h`;
  return h % 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${Math.floor(h / 24)} d`;
}

/** Public ticket code, e.g. A-007. */
export const code = (t: Pick<Ticket, 'id'>) => 'A-' + String(t.id).padStart(3, '0');
/** Solved by the team. */
export const isResolved = (t: Ticket) => t.status === 'Resolvido' || t.status === 'Fechado';
/** Finished in any way: solved, cancelled or rejected. */
export const isClosed = (t: Ticket) => isResolved(t) || t.status === 'Cancelado' || t.status === 'Reprovado';

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

/** One line of a transcript: a message (with its attachments) or an activity event. */
export type TranscriptEntry =
  | { kind: 'msg'; at: number; author: string; body: string; via?: Channel; internal?: boolean; files: Attachment[] }
  | { kind: 'event'; at: number; text: string };

/**
 * The conversation as it stood when the transcript was taken (`upTo`): messages and events in order.
 * Messages are append-only, so filtering by time is a faithful snapshot without copying media.
 */
export function transcriptEntries(t: Ticket, upTo: number): TranscriptEntry[] {
  return [
    ...t.log.filter((l) => l.at <= upTo).map((l): TranscriptEntry => ({ kind: 'event', at: l.at, text: l.text })),
    ...t.messages
      .filter((m) => m.at <= upTo && !(m.internal && m.body.startsWith('📄 Transcrição')))
      .map((m): TranscriptEntry => ({ kind: 'msg', at: m.at, author: m.author, body: m.body, via: m.via, internal: m.internal, files: m.files ?? [] })),
  ].sort((a, b) => a.at - b.at);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained HTML transcript: text plus images and audio embedded (they are data URLs). */
export function transcriptHtml(head: { code: string; title: string; company: string; requester: string }, entries: TranscriptEntry[]): string {
  const when = (ts: number) => esc(new Date(ts).toLocaleString('pt-BR'));
  const file = (f: Attachment) =>
    f.type.startsWith('image/') ? `<img src="${esc(f.url)}" alt="${esc(f.name)}">`
    : f.type.startsWith('audio/') ? `<audio controls src="${esc(f.url)}"></audio><small>${esc(f.name)}</small>`
    : `<a download="${esc(f.name)}" href="${esc(f.url)}">📎 ${esc(f.name)}</a>`;
  const rows = entries
    .map((e) =>
      e.kind === 'event'
        ? `<p class="ev">${when(e.at)} — ${esc(e.text)}</p>`
        : `<div class="msg${e.internal ? ' note' : ''}"><b>${esc(e.author)}</b> <small>${when(e.at)}${e.internal ? ' · nota interna' : e.via ? ' · via ' + esc(e.via) : ''}</small>` +
          `${e.body ? `<p>${esc(e.body).replace(/\n/g, '<br>')}</p>` : ''}${e.files.map(file).join('')}</div>`,
    )
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Transcrição ${esc(head.code)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#1d2233}h1{font-size:20px}
.msg{border:1px solid #e3e6ec;border-radius:10px;padding:10px 14px;margin:10px 0}.note{background:#fff8e8}.ev{color:#6b7286;font-size:13px}
img{display:block;max-width:100%;max-height:360px;border-radius:8px;margin-top:8px}audio{display:block;margin-top:8px}small{color:#6b7286}</style>
<h1>${esc(head.code)} — ${esc(head.title)}</h1><p><small>${esc(head.company)} · solicitante ${esc(head.requester)}</small></p>
${rows}</html>`;
}

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

/** A customer company served by AIOA. Each one gets its own tab on the Tickets page. */
export interface Customer {
  name: Company;
  /** Short code shown on tabs and charts, e.g. "LA - AM". */
  short: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  since: string;
  systems: System[];
  /** Customer users allowed into the portal to open and follow tickets. */
  members: Member[];
}

/** A customer user (usuário-cliente). */
export interface Member {
  name: string;
  email: string;
  role: string;
  since: number;
}

/** Stable Tickets-tab id for a customer, e.g. "LA - AM" -> "co-la-am". */
export const customerTabId = (short: string) =>
  'co-' + short.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Demo members for a customer: its known staff (or just the contact), with e-mails on the company's domain. */
function defaultMembers(c: Pick<Customer, 'name' | 'contact' | 'email'>, at: number): Member[] {
  const domain = c.email.split('@')[1] || 'cliente.exemplo.com';
  const names = STAFF[c.name] ?? [c.contact];
  return names.map((name, i) => ({
    name,
    email: `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(.*?\)|—.*$/g, '').trim().replace(/[^a-z0-9]+/g, '.')}@${domain}`,
    role: i === 0 ? 'Contato principal' : 'Usuário',
    since: at,
  }));
}

const SHORTS: Record<Company, string> = {
  'Nicolas Gomes Advogado': 'NG',
  'Luis Albert Advogado - AM': 'LA - AM',
  'Luis Albert Advogado - RJ': 'LA - RJ',
  LexFinance: 'LEXFINANCE',
};

const CUSTOMER_INFO: Record<Company, { email: string; phone: string; city: string; since: string; systems: System[] }> = {
  'Nicolas Gomes Advogado': { email: 'contato@nicolasgomes.exemplo.com', phone: '(11) 4000-1001', city: 'São Paulo - SP', since: 'mar/2024', systems: ['LexFlow', 'LexÁgile', 'LexHub', 'LexChat'] },
  'Luis Albert Advogado - AM': { email: 'am@luisalbert.exemplo.com', phone: '(92) 4000-2002', city: 'Manaus - AM', since: 'ago/2024', systems: ['LexHub', 'LexÁgile'] },
  'Luis Albert Advogado - RJ': { email: 'rj@luisalbert.exemplo.com', phone: '(21) 4000-3003', city: 'Rio de Janeiro - RJ', since: 'ago/2024', systems: ['LexFlow', 'LexChat', 'LexPré'] },
  LexFinance: { email: 'suporte@lexfinance.exemplo.com', phone: '(11) 4000-4004', city: 'São Paulo - SP', since: 'jan/2025', systems: ['LexFlow', 'LexÁgile', 'LexHub', 'LexPré', 'LexChat'] },
};

const CONTACTS: Record<Company, string> = {
  'Nicolas Gomes Advogado': 'Nicolas Gomes',
  'Luis Albert Advogado - AM': 'Luis Albert (AM)',
  'Luis Albert Advogado - RJ': 'Luis Albert (RJ)',
  LexFinance: 'Carla — LexFinance',
};


const SEED: [string, System, Company, Priority, Status, number, Category, string][] = [
  ['Erro ao gerar petição no fluxo de contencioso', 'LexFlow', 'Nicolas Gomes Advogado', 'Alta', 'Aberto', 2, 'Bug', 'Erro de tela'],
  ['Sprint não aparece no quadro kanban', 'LexÁgile', 'LexFinance', 'Média', 'Em andamento', 20, 'Bug', 'Erro de tela'],
  ['Integração com o PJe retornando timeout', 'LexHub', 'Luis Albert Advogado - AM', 'Urgente', 'Aberto', 5, 'Bug', 'Integração'],
  ['Pré-análise com valores divergentes', 'LexPré', 'LexFinance', 'Alta', 'Em andamento', 30, 'Bug', 'Dados incorretos'],
  ['Bot do WhatsApp não responde fora do horário', 'LexChat', 'Luis Albert Advogado - RJ', 'Média', 'Aguardando cliente', 48, 'Funcionalidade', 'Configuração'],
  ['Solicitação de novo usuário', 'Outros', 'Nicolas Gomes Advogado', 'Baixa', 'Resolvido', 96, 'Acesso', 'Novo usuário'],
  ['Prazo duplicado na agenda', 'LexFlow', 'Luis Albert Advogado - RJ', 'Média', 'Aberto', 10, 'Bug', 'Dados incorretos'],
  ['Lentidão ao abrir processos', 'LexHub', 'Nicolas Gomes Advogado', 'Alta', 'Resolvido', 120, 'Bug', 'Lentidão'],
  ['Exportação de relatório em PDF quebrada', 'LexÁgile', 'Luis Albert Advogado - AM', 'Baixa', 'Aberto', 60, 'Dashboard', 'Relatório'],
  ['Histórico de conversas sumiu', 'LexChat', 'LexFinance', 'Alta', 'Em andamento', 7, 'Bug', 'Dados incorretos'],
  ['Importação de planilha de clientes', 'LexPré', 'Luis Albert Advogado - RJ', 'Média', 'Fechado', 200, 'Funcionalidade', 'Dúvida de uso'],
  ['Impressora do escritório não conecta', 'Outros', 'Luis Albert Advogado - AM', 'Baixa', 'Aguardando cliente', 26, 'Suporte de T.I.', 'Equipamento'],
  ['Notificações por e-mail não chegam', 'LexFlow', 'LexFinance', 'Média', 'Resolvido', 150, 'Funcionalidade', 'Configuração'],
  ['Permissão negada ao editar tarefa', 'LexÁgile', 'Nicolas Gomes Advogado', 'Alta', 'Aberto', 1, 'Acesso', 'Permissão'],
  ['Transferência de atendimento entre agentes', 'LexChat', 'Nicolas Gomes Advogado', 'Média', 'Resolvido', 80, 'Funcionalidade', 'Dúvida de uso'],
  ['Certificado digital expirado no LexHub', 'LexHub', 'LexFinance', 'Urgente', 'Em andamento', 3, 'Suporte de T.I.', 'Certificado digital'],
  ['Acesso ao módulo financeiro para estagiário', 'LexFlow', 'Luis Albert Advogado - AM', 'Baixa', 'Cancelado', 140, 'Acesso', 'Permissão'],
  ['Relatório personalizado de horas por cliente', 'LexÁgile', 'LexFinance', 'Média', 'Reprovado', 110, 'Melhorias', 'Nova funcionalidade'],
];

/** People at each customer who open tickets (the main contact comes first). */
const STAFF: Record<Company, string[]> = {
  'Nicolas Gomes Advogado': ['Nicolas Gomes', 'Fernanda Lima', 'Rafael Souza'],
  'Luis Albert Advogado - AM': ['Luis Albert (AM)', 'Juliana Prado'],
  'Luis Albert Advogado - RJ': ['Luis Albert (RJ)', 'Marcos Teixeira'],
  LexFinance: ['Carla — LexFinance', 'Diego Martins', 'Patrícia Alves'],
};

const SAMPLE_TITLES: Record<string, string> = {
  'Erro de tela': 'Tela em branco ao salvar', Lentidão: 'Sistema lento no horário de pico', Integração: 'Falha na sincronização com o tribunal',
  'Dados incorretos': 'Valores divergentes no relatório', 'Novo usuário': 'Cadastro de novo colaborador', Permissão: 'Ajuste de permissões de acesso',
  'Login e senha': 'Redefinição de senha', 'Dúvida de uso': 'Dúvida sobre o fluxo de cadastro', Configuração: 'Configurar notificações automáticas',
  Sugestão: 'Sugestão de atalho na tela inicial', 'Nova funcionalidade': 'Exportar dados para Excel', Relatório: 'Relatório mensal não carrega',
  Indicadores: 'Indicador de produtividade zerado', Equipamento: 'Notebook sem acesso ao sistema', Rede: 'Instabilidade na VPN',
  'Certificado digital': 'Instalação de certificado digital',
};

/**
 * About 12 months of finished tickets so trends and rankings have something to show.
 * ponytail: synthetic, deterministic demo history; drop it once real data exists.
 */
function history(now: number): Ticket[] {
  let state = 42;
  const rnd = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const cats: Category[] = ['Bug', 'Bug', 'Bug', 'Acesso', 'Acesso', 'Funcionalidade', 'Funcionalidade', 'Melhorias', 'Dashboard', 'Suporte de T.I.', 'Suporte de T.I.'];
  const closers = ['Ana Rocha', 'Ana Rocha', 'Ana Rocha', 'Mateus Silva', 'Mateus Silva', 'Bruno Lima'];
  const out: Ticket[] = [];
  const today = new Date(now);
  for (let back = 11; back >= 0; back--) {
    const start = new Date(today.getFullYear(), today.getMonth() - back, 1).getTime();
    const end = back ? new Date(today.getFullYear(), today.getMonth() - back + 1, 1).getTime() : now - 10 * 24 * H;
    const count = back ? 8 + Math.floor(rnd() * 9) + (back === 8 ? 8 : 0) : 5;
    for (let n = 0; n < count && end > start; n++) {
      const createdAt = start + rnd() * (end - start);
      const category = pick(cats);
      const subcategory = pick(CATEGORIES[category]);
      const company = pick(COMPANIES);
      const requester = pick(STAFF[company]);
      const closedBy = pick(closers);
      const roll = rnd();
      const status: Status = roll < 0.1 ? 'Cancelado' : roll < 0.18 ? 'Reprovado' : roll < 0.55 ? 'Fechado' : 'Resolvido';
      const doneAt = Math.min(now - H, createdAt + (2 + rnd() * 58) * H);
      const title = SAMPLE_TITLES[subcategory];
      const via = pick(CHANNELS);
      const closing = status === 'Cancelado' ? 'Cancelado a pedido do cliente.' : status === 'Reprovado' ? 'Solicitação fora do escopo do produto.' : 'Resolvido, obrigado pelo retorno!';
      out.push({
        id: 0, title, description: `${title}. Poderiam ajudar?`, company, system: pick(SYSTEMS), priority: pick(PRIORITIES), status,
        assignee: closedBy, requester, createdAt, updatedAt: doneAt, resolvedAt: doneAt, closedBy, pinned: false, tasks: [],
        category, subcategory,
        messages: [
          { author: requester, body: `${title}. Poderiam ajudar?`, at: createdAt, via },
          { author: closedBy, body: closing, at: doneAt, via },
        ],
        log: [{ at: createdAt, text: `${requester} abriu o chamado via ${via}` }, { at: doneAt, text: `${closedBy} alterou o status para ${status}` }],
      });
    }
  }
  return out.sort((a, b) => a.createdAt - b.createdAt).map((t, i) => ({ ...t, id: i + 1 }));
}

export function seed() {
  const now = Date.now();
  const past = history(now);
  const current: Ticket[] = SEED.map(([title, system, company, priority, status, hrs, category, subcategory], i) => {
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
    if (status === 'Cancelado' || status === 'Reprovado') {
      const why = status === 'Cancelado' ? 'Cliente informou que não precisa mais deste acesso.' : 'Solicitação fora do escopo do produto; registrada como sugestão de melhoria.';
      messages.push({ author: assignee ?? AGENTS[0], body: why, at: doneAt, via });
      log.push({ at: doneAt, text: `Status alterado para ${status}` });
    }
    return {
      id: past.length + i + 1, title, description, system, company, category, subcategory, priority, status, assignee, createdAt, requester, log,
      closedBy: closed || status === 'Cancelado' || status === 'Reprovado' ? (assignee ?? AGENTS[0]) : undefined,
      updatedAt: messages[messages.length - 1].at,
      resolvedAt: closed ? doneAt : undefined,
      pinned: i === 2 || i === 15,
      messages,
      tasks: assignee
        ? [{ text: 'Reproduzir o problema em homologação', done: true }, { text: 'Aplicar correção', done: closed }, { text: 'Validar com o cliente', done: closed }]
        : [],
    };
  });
  const tickets = [...past, ...current];
  const ref = (i: number) => ({ ticketId: current[i].id, code: code(current[i]) });
  // Demo votes: the first `up` people upvote, the next `down` downvote.
  const crowd = ['Ana Rocha', 'Bruno Lima', 'Nicolas Gomes', 'Fernanda Lima', 'Rafael Souza', 'Juliana Prado', 'Marcos Teixeira',
    'Diego Martins', 'Patrícia Alves', 'Carla — LexFinance', 'Luis Albert (AM)', 'Luis Albert (RJ)'];
  const votes = (up: number, down = 0): Votes =>
    Object.fromEntries(crowd.slice(0, up + down).map((n, i) => [n, i < up ? 1 : -1])) as Votes;
  const topics: Topic[] = [
    { id: 1, title: 'Como configurar regras de distribuição de prazos no LexFlow?', system: 'LexFlow', author: 'Nicolas Gomes', at: now - 50 * H,
      body: 'Temos 3 advogados e queremos que os prazos trabalhistas caiam sempre para a mesma pessoa. Dá para automatizar?', votes: votes(9, 1),
      replies: [
        { author: 'Ana Rocha', body: 'Dá sim! Em Configurações › Fluxos › Prazos você cria uma regra por tipo de processo e escolhe o responsável.', at: now - 46 * H, votes: votes(7) },
        { author: 'Nicolas Gomes', body: 'Funcionou perfeitamente, obrigado!', at: now - 44 * H, votes: votes(3), parent: 0 },
        { author: 'Fernanda Lima', body: 'Alguém sabe se a regra vale para prazos já cadastrados?', at: now - 30 * H, votes: votes(2) },
        { author: 'Bruno Lima', body: 'Só para os novos. Para os antigos, use "Redistribuir" na lista de prazos.', at: now - 28 * H, votes: votes(4), parent: 2 },
      ] },
    { id: 2, title: 'Boas práticas para respostas automáticas no LexChat', system: 'LexChat', author: 'Carla — LexFinance', at: now - 30 * H,
      body: 'Quais mensagens vocês usam fora do horário? Quero algo cordial, mas que não prometa prazo.', votes: votes(6),
      replies: [{ author: 'Juliana Prado', body: 'Usamos: "Recebemos sua mensagem e retornamos no próximo dia útil a partir das 8h." Simples e funciona.', at: now - 26 * H, votes: votes(5) }] },
    { id: 3, title: 'Atalhos de teclado no quadro do LexÁgile', system: 'LexÁgile', author: 'Bruno Lima', at: now - 8 * H,
      body: 'Compilado dos atalhos: N cria tarefa, / busca, ← → move entre colunas e E edita o card selecionado.', votes: votes(11),
      replies: [{ author: 'Luis Albert (RJ)', body: 'Muito útil, obrigado!', at: now - 6 * H, votes: votes(2) }] },
    { id: 4, title: 'Certificado A3 não é reconhecido no LexHub depois da atualização do Windows', system: 'LexHub', author: 'Marcos Teixeira', at: now - 20 * H,
      body: 'Depois da última atualização o token sumiu da lista de certificados. Alguém passou por isso?', votes: votes(5, 1),
      replies: [
        { author: 'Mateus Silva', body: 'Reinstale o driver do token (SafeNet) e reinicie o navegador. Abrimos um artigo na base sobre certificados.', at: now - 18 * H, votes: votes(6) },
        { author: 'Marcos Teixeira', body: 'Era o driver mesmo, resolvido!', at: now - 17 * H, votes: votes(1), parent: 0 },
      ] },
    { id: 5, title: 'Sugestão: exportar a pré-análise direto para PDF', system: 'LexPré', author: 'Diego Martins', at: now - 70 * H,
      body: 'Hoje precisamos copiar para o Word. Um botão "Exportar PDF" economizaria bastante tempo da equipe.', votes: votes(8),
      replies: [{ author: 'Ana Rocha', body: 'Levamos para o time de produto, está no roadmap!', at: now - 60 * H, votes: votes(4) }] },
    { id: 6, title: 'Impressora de rede some todo dia depois do almoço', system: 'Outros', author: 'Juliana Prado', at: now - 3 * H,
      body: 'Precisamos reiniciar o roteador para ela voltar. Algum palpite?', votes: votes(2), replies: [] },
  ];
  const notices: Notice[] = [
    { id: 1, ticketId: ref(13).ticketId, text: `Novo chamado ${ref(13).code} aberto por Nicolas Gomes`, at: now - 1 * H, read: false },
    { id: 2, ticketId: ref(2).ticketId, text: `Chamado ${ref(2).code} está perto de estourar o SLA`, at: now - 1.5 * H, read: false },
    { id: 3, ticketId: ref(0).ticketId, text: `Novo chamado ${ref(0).code} aberto por Nicolas Gomes`, at: now - 2 * H, read: false },
    { id: 4, ticketId: ref(4).ticketId, text: `Luis Albert (RJ) respondeu o chamado ${ref(4).code}`, at: now - 20 * H, read: true },
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
  const customers: Customer[] = COMPANIES.map((c) => {
    const base = { name: c, short: SHORTS[c], contact: CONTACTS[c], ...CUSTOMER_INFO[c] };
    return { ...base, members: defaultMembers(base, now - 200 * 24 * H) };
  });
  return { tickets, topics, notices, articles, conversations, transcripts, customers, portalUser: null as PortalUser | null, user: { name: 'Mateus Silva', role: 'Analista de suporte' } as User, prefs: DEFAULT_PREFS, demos: [] as DemoRequest[], portalSeen: {} as Record<string, number> };
}

export function toTranscript(t: Ticket, by: string, at = Date.now()): Transcript {
  return {
    id: at + t.id, ticketId: t.id, code: code(t), title: t.title, company: t.company, system: t.system,
    requester: t.requester, assignee: t.assignee, at, by, text: transcript(t, at),
  };
}

const KEY = 'aioa:v6'; // v6: forum posts with body, votes and nested replies
// ponytail: localStorage is the whole backend; swap for an HTTP API when the prototype is validated.
@Injectable({ providedIn: 'root' })
export class Store {
  private readonly db = signal(this.load());
  /** Set by Backend when Supabase is configured. */
  remote?: Remote;
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
  readonly customers = computed(() => this.db().customers);
  /** Everyone you can DM: the support team plus each customer's contact. */
  readonly people = computed(() => [
    ...AGENTS.map((name) => ({ name, org: 'Equipe AIOA' })),
    ...this.customers().map((c) => ({ name: c.contact, org: c.name })),
  ]);
  readonly user = computed(() => this.db().user);
  readonly prefs = computed(() => this.db().prefs);
  readonly pinned = computed(() => this.tickets().filter((t) => t.pinned));
  readonly unread = computed(() => this.notices().filter((n) => !n.read).length);

  constructor() {
    effect(() => {
      if (typeof localStorage === 'undefined') return;
      try {
        // With a backend, the core collections come from the server: only local-only data is cached.
        const { tickets, customers, transcripts, ...local } = this.db();
        localStorage.setItem(KEY, JSON.stringify(this.remote ? local : { tickets, customers, transcripts, ...local }));
      } catch {
        // ponytail: attachments live in localStorage (~5 MB); move files to object storage with the real backend.
        alert('O armazenamento do protótipo está cheio. Remova anexos ou restaure os dados de exemplo em Configurações.');
      }
    });
    // Other tabs (e.g. the customer portal) write to the same storage: pick their changes up live.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== KEY || !e.newValue) return;
        try {
          this.db.set(JSON.parse(e.newValue));
        } catch {}
      });
    }
  }

  private load(): ReturnType<typeof seed> {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
      if (raw) {
        const db = { ...seed(), ...JSON.parse(raw) }; // new collections get seeded, saved ones win
        // Customers saved before members existed get their demo members.
        db.customers = db.customers.map((c: Customer) => (c.members ? c : { ...c, members: defaultMembers(c, Date.now()) }));
        return db;
      }
    } catch {}
    return seed();
  }

  reset() {
    this.db.set(seed());
  }

  /** Replaces collections with server data (Backend). */
  hydrate(p: Partial<Pick<ReturnType<typeof seed>, 'tickets' | 'customers' | 'transcripts'>>) {
    this.db.update((db) => ({ ...db, ...p }));
  }

  /** Swaps one ticket for its server copy (realtime), keeping the list order. */
  putTicket(t: Ticket) {
    this.db.update((db) => ({
      ...db,
      tickets: db.tickets.some((x) => x.id === t.id) ? db.tickets.map((x) => (x.id === t.id ? { ...t, pinned: x.pinned } : x)) : [t, ...db.tickets],
    }));
  }

  /** Team notification (new ticket / customer reply), also used by realtime. */
  notify(ticketId: number, text: string) {
    const now = Date.now();
    this.db.update((db) => ({ ...db, notices: [{ id: now + Math.random(), ticketId, text, at: now, read: false }, ...db.notices] }));
  }

  ticket(id: number) {
    return this.tickets().find((t) => t.id === id);
  }

  async createTicket(d: Pick<Ticket, 'title' | 'description' | 'company' | 'system' | 'category' | 'subcategory' | 'priority' | 'requester'> & { via: Channel; files?: Attachment[] }) {
    const now = Date.now();
    const { via, files, ...rest } = d;
    const t: Ticket = {
      ...rest, id: Math.max(0, ...this.tickets().map((x) => x.id)) + 1, status: 'Aberto', assignee: null, createdAt: now, updatedAt: now, pinned: false, tasks: [],
      messages: [{ author: d.requester, body: d.description, at: now, via, files }],
      log: [{ at: now, text: `${d.requester} abriu o chamado via ${via}` }],
    };
    if (this.remote) t.id = await this.remote.createTicket(t);
    const id = t.id;
    if (this.tickets().some((x) => x.id === id)) return id; // realtime already brought it in
    this.db.update((db) => ({
      ...db,
      tickets: [t, ...db.tickets],
      notices: this.remote ? db.notices : [{ id: now, ticketId: id, text: `Novo chamado ${code(t)} aberto por ${d.requester}`, at: now, read: false }, ...db.notices],
    }));
    return id;
  }

  /** Patches a ticket; status/priority/assignee changes are written to its activity log. */
  updateTicket(id: number, patch: Partial<Ticket>) {
    const now = Date.now();
    const who = this.user().name;
    const prev = this.ticket(id);
    this.db.update((db) => ({
      ...db,
      tickets: db.tickets.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch, updatedAt: now };
        const log = [...(patch.log ?? t.log)];
        if (patch.status && patch.status !== t.status) {
          next.resolvedAt = isClosed(next) ? (t.resolvedAt ?? now) : undefined;
          next.closedBy = isClosed(next) ? (t.closedBy ?? who) : undefined;
          log.push({ at: now, text: `${who} alterou o status para ${patch.status}` });
        }
        if (patch.priority && patch.priority !== t.priority) log.push({ at: now, text: `${who} alterou a prioridade para ${patch.priority}` });
        if ('assignee' in patch && patch.assignee !== t.assignee)
          log.push({ at: now, text: patch.assignee ? `Chamado atribuído a ${patch.assignee}` : 'Responsável removido' });
        next.log = log;
        return next;
      }),
    }));
    const next = this.ticket(id);
    if (this.remote && prev && next) this.remote.syncTicket(prev, next);
  }

  /** Adds a customer company (its Tickets tab appears automatically). Returns false if the name already exists. */
  /** Adds a member to a customer. Returns an error message, or '' on success. */
  addMember(company: Company, m: Omit<Member, 'since'>) {
    const c = this.customers().find((x) => x.name === company);
    if (!c) return 'Cliente não encontrado.';
    if (c.members.some((x) => x.email.toLowerCase() === m.email.toLowerCase())) return `Já existe um membro com o e-mail ${m.email}.`;
    if (c.members.some((x) => x.name.toLowerCase() === m.name.toLowerCase())) return `Já existe um membro chamado ${m.name}.`;
    const member: Member = { ...m, since: Date.now() };
    this.remote?.addMember(company, member);
    this.db.update((db) => ({ ...db, customers: db.customers.map((x) => (x.name === company ? { ...x, members: [...x.members, member] } : x)) }));
    return '';
  }

  /** Systems a customer has contracted; its members can open tickets only for these (plus "Outros"). */
  setSystems(company: Company, systems: System[]) {
    this.remote?.setSystems(company, systems);
    this.db.update((db) => ({ ...db, customers: db.customers.map((x) => (x.name === company ? { ...x, systems } : x)) }));
  }

  removeMember(company: Company, email: string) {
    this.remote?.removeMember(company, email);
    this.db.update((db) => ({
      ...db,
      customers: db.customers.map((x) => (x.name === company ? { ...x, members: x.members.filter((m) => m.email !== email) } : x)),
    }));
  }

  createCustomer(c: Customer) {
    if (this.customers().some((x) => x.name.toLowerCase() === c.name.toLowerCase())) return false;
    this.remote?.createCustomer(c);
    this.db.update((db) => ({ ...db, customers: [...db.customers, c] }));
    return true;
  }

  portalLogin(user: PortalUser | null) {
    // On someone's first sign-in, older activity counts as already seen.
    const base = user && `${user.name}:base`;
    this.db.update((db) => ({ ...db, portalUser: user, portalSeen: base && !db.portalSeen[base] ? { ...db.portalSeen, [base]: Date.now() } : db.portalSeen }));
  }

  /** When the portal user last looked at `what` ('notices', 'inbox' or 't<ticket id>'). */
  portalSeenAt(what: string) {
    const u = this.portalUser();
    if (!u) return 0;
    const seen = this.db().portalSeen;
    return Math.max(seen[`${u.name}:${what}`] ?? 0, seen[`${u.name}:base`] ?? 0);
  }

  markPortalSeen(what: string) {
    const u = this.portalUser();
    if (u) this.db.update((db) => ({ ...db, portalSeen: { ...db.portalSeen, [`${u.name}:${what}`]: Date.now() } }));
  }

  /** The portal user's direct conversation with the support team (it shows up in the team's Inbox). */
  customerConversation() {
    const u = this.portalUser();
    return u ? this.db().conversations.find((c) => c.with === u.name) : undefined;
  }

  customerDm(body: string, files: Attachment[] = []) {
    const u = this.portalUser();
    if (!u) return;
    const m = { author: u.name, body, at: Date.now(), files };
    this.db.update((db) => {
      const found = db.conversations.some((c) => c.with === u.name);
      const conversations = found
        ? db.conversations.map((c) => (c.with === u.name ? { ...c, unread: c.unread + 1, messages: [...c.messages, m] } : c))
        : [...db.conversations, { id: m.at, with: u.name, org: u.company, unread: 1, messages: [m] }];
      return { ...db, conversations };
    });
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
    const prev = t;
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
      notices: this.remote ? db.notices : [{ id: now, ticketId: id, text: `${who} respondeu o chamado ${code(t)}`, at: now, read: false }, ...db.notices],
    }));
    const next = this.ticket(id);
    if (this.remote && next) this.remote.syncTicket(prev, next);
  }

  /**
   * Resolves a ticket: sends the customer a closing message, archives the full transcript in
   * Histórico de tickets and as an internal note with a .txt attachment, then sets it to Resolvido.
   * Used by the ticket screen and by the kanban.
   */
  resolve(id: number, via?: Channel) {
    const t = this.ticket(id);
    if (!t) return;
    const channel = via ?? t.messages[0]?.via ?? 'Portal';
    this.reply(id, this.prefs().closing.replaceAll('{cliente}', t.requester).replaceAll('{codigo}', code(t)), channel);
    const text = this.saveTranscript(id).text;
    const file = {
      name: `transcricao-${code(t)}.txt`,
      type: 'text/plain',
      size: new Blob([text]).size,
      url: 'data:text/plain;charset=utf-8,' + encodeURIComponent('\ufeff' + text),
    };
    if (this.prefs().transcriptNote) this.reply(id, '📄 Transcrição completa do atendimento gerada antes do encerramento.', channel, true, [file]);
    this.updateTicket(id, { status: 'Resolvido' });
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

  /** New forum post (the author upvotes it, as on Reddit); returns its id. */
  createTopic(title: string, system: System, body: string, author = this.user().name) {
    const now = Date.now();
    this.db.update((db) => ({
      ...db,
      topics: [{ id: now, title, system, author, at: now, body, votes: { [author]: 1 } as Votes, replies: [] }, ...db.topics],
    }));
    return now;
  }

  /** Comments on a post, or answers comment `parent` (index in replies). */
  replyTopic(id: number, body: string, parent?: number, author = this.user().name) {
    const r: Comment = { author, body, at: Date.now(), parent };
    this.db.update((db) => ({ ...db, topics: db.topics.map((t) => (t.id === id ? { ...t, replies: [...t.replies, r] } : t)) }));
  }

  /** Up/down vote on a post (or on comment `comment`); voting the same way again removes the vote. */
  vote(topicId: number, dir: 1 | -1, comment?: number, who = this.user().name) {
    const flip = (v?: Votes): Votes => {
      const next = { ...v };
      if (next[who] === dir) delete next[who];
      else next[who] = dir;
      return next;
    };
    this.db.update((db) => ({
      ...db,
      topics: db.topics.map((t) =>
        t.id !== topicId ? t
          : comment == null ? { ...t, votes: flip(t.votes) }
          : { ...t, replies: t.replies.map((r, i) => (i === comment ? { ...r, votes: flip(r.votes) } : r)) },
      ),
    }));
  }

  createArticle(d: Pick<Article, 'title' | 'system' | 'summary' | 'body'>) {
    const now = Date.now();
    this.db.update((db) => ({ ...db, articles: [{ ...d, id: now, author: this.user().name, updatedAt: now, views: 0 }, ...db.articles] }));
  }

  /** Likes or un-likes an article on behalf of `who`. */
  toggleLike(id: number, who: string) {
    this.db.update((db) => ({
      ...db,
      articles: db.articles.map((a) => {
        if (a.id !== id) return a;
        const likes = a.likes ?? [];
        return { ...a, likes: likes.includes(who) ? likes.filter((n) => n !== who) : [...likes, who] };
      }),
    }));
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
    const t = this.ticket(ticketId)!;
    const tr = toTranscript(t, this.user().name);
    this.remote?.saveTranscript(tr, t);
    this.db.update((db) => ({ ...db, transcripts: [tr, ...db.transcripts] }));
    return tr;
  }

  setUser(user: User) {
    this.db.update((db) => ({ ...db, user }));
  }

  setPrefs(patch: Partial<Prefs>) {
    this.db.update((db) => ({ ...db, prefs: { ...db.prefs, ...patch } }));
  }

  // ponytail: demo requests are only stored; list them for the sales team when someone owns the follow-up.
  requestDemo(d: Omit<DemoRequest, 'at'>) {
    this.db.update((db) => ({ ...db, demos: [{ ...d, at: Date.now() }, ...db.demos] }));
  }
}
