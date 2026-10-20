import { Injectable, inject, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.config';
import {
  AGENTS, Attachment, Company, Customer, Member, Message, Remote, Store, System, Ticket, Transcript,
  code, transcript, transcriptEntries, transcriptHtml,
} from './data';

type Role = 'tech' | 'member' | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped rows; generate types with `supabase gen types` later.
type Row = any;
type StoredFile = { name: string; type: string; size: number; path: string };

const ms = (v?: string | null) => (v ? new Date(v).getTime() : undefined);
const iso = (v?: number) => (v == null ? null : new Date(v).toISOString());
const safe = (name: string) => name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);

/**
 * Supabase as the source of truth for companies, members, tickets, messages, events and transcripts.
 * The Store stays the in-memory model the screens read; this service loads it, keeps it live (realtime)
 * and writes every change back. Files (attachments, transcripts) go to Storage.
 */
@Injectable({ providedIn: 'root' })
export class Backend implements Remote {
  readonly enabled = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && typeof window !== 'undefined';
  readonly session = signal<Session | null>(null);
  readonly role = signal<Role>(null);
  private readonly store = inject(Store);
  private readonly sb?: SupabaseClient;
  private companyIds = new Map<string, string>(); // name -> id
  private ready?: Promise<Role>;

  constructor() {
    if (!this.enabled) return;
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.store.remote = this;
    this.ready = this.boot();
    this.sb.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') this.ready = this.boot(session);
    });
  }

  /** Resolves once the session (if any) is known and the data is loaded. */
  whenReady() {
    return this.ready ?? Promise.resolve<Role>(null);
  }

  // ---------- auth ----------
  signIn(email: string, password: string) {
    return this.sb!.auth.signInWithPassword({ email, password });
  }

  signUp(email: string, password: string) {
    return this.sb!.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/login` } });
  }

  google() {
    return this.sb!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/login` } });
  }

  resetPassword(email: string) {
    return this.sb!.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
  }

  signOut() {
    return this.sb!.auth.signOut();
  }

  /** Who the session is (team or customer) and loading their data. */
  private async boot(session?: Session | null): Promise<Role> {
    const s = session === undefined ? (await this.sb!.auth.getSession()).data.session : session;
    this.session.set(s);
    if (!s) {
      this.role.set(null);
      this.store.portalLogin(null);
      this.store.hydrate({ tickets: [], customers: [], transcripts: [] }); // nothing of the previous user stays on screen
      return null;
    }
    const email = (s.user.email ?? '').toLowerCase();
    const { data: staff } = await this.sb!.from('staff').select('email, name, role');
    // ponytail: AGENTS doubles as the team list on screen; with a backend it's replaced by the staff table.
    if (staff?.length) AGENTS.splice(0, AGENTS.length, ...staff.map((x) => x.name as string));
    const me = staff?.find((x) => x.email.toLowerCase() === email);
    let role: Role = null;
    if (me) {
      role = 'tech';
      this.store.setUser({ name: me.name, role: me.role });
    } else {
      const { data: m } = await this.sb!.from('members').select('name, companies(name)').ilike('email', email).maybeSingle();
      if (m) {
        role = 'member';
        this.store.portalLogin({ name: m.name, company: (m.companies as unknown as { name: string }).name });
      }
    }
    this.role.set(role);
    if (role) {
      await this.load();
      this.listen();
    }
    return role;
  }

  // ---------- load ----------
  /** Reads a whole table, 1000 rows per request (PostgREST's default page size). */
  private async all(table: string, select = '*', order = 'id') {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb!.from(table).select(select).order(order).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data as Row[]));
      if (!data || data.length < 1000) return rows;
    }
  }

  private async load() {
    const [companies, members, tickets, messages, events, transcripts] = await Promise.all([
      this.all('companies', '*', 'created_at'),
      this.all('members', '*', 'since'),
      this.all('tickets'),
      this.all('messages'),
      this.all('ticket_events'),
      this.all('transcripts'),
    ]);
    this.companyIds = new Map(companies.map((c) => [c.name, c.id]));
    const nameOf = new Map(companies.map((c) => [c.id, c.name as string]));
    const urls = await this.signedUrls(messages.flatMap((m) => (m.files as StoredFile[]).map((f) => f.path)));
    const ts = tickets.map((t) => this.toTicket(t, nameOf.get(t.company_id) ?? '', messages, events, urls));
    const byId = new Map(ts.map((t) => [t.id, t]));
    this.store.hydrate({
      customers: companies.map((c) => this.toCustomer(c, members)),
      tickets: ts.sort((a, b) => b.createdAt - a.createdAt),
      transcripts: transcripts
        .map((r) => this.toTranscript(r, nameOf.get(r.company_id) ?? '', byId.get(r.ticket_id)))
        .sort((a, b) => b.at - a.at),
    });
  }

  private toCustomer(c: Row, members: Row[]): Customer {
    return {
      name: c.name, short: c.short, contact: c.contact, email: c.email, phone: c.phone, city: c.city, since: c.since, systems: c.systems,
      members: members.filter((m) => m.company_id === c.id).map((m): Member => ({ name: m.name, email: m.email, role: m.role, since: ms(m.since)! })),
    };
  }

  private toTicket(t: Row, company: string, messages: Row[], events: Row[], urls: Map<string, string>): Ticket {
    return {
      id: t.id, title: t.title, description: t.description, company, system: t.system, category: t.category, subcategory: t.subcategory,
      priority: t.priority, status: t.status, assignee: t.assignee, closedBy: t.closed_by ?? undefined, requester: t.requester,
      createdAt: ms(t.created_at)!, updatedAt: ms(t.updated_at)!, resolvedAt: ms(t.resolved_at), pinned: false, tasks: t.tasks ?? [],
      messages: messages.filter((m) => m.ticket_id === t.id).map((m): Message => ({
        author: m.author, body: m.body, at: ms(m.created_at)!, via: m.via ?? undefined, internal: m.internal,
        files: (m.files as StoredFile[]).map((f) => ({ name: f.name, type: f.type, size: f.size, url: urls.get(f.path) ?? '' })),
      })),
      log: events.filter((e) => e.ticket_id === t.id).map((e) => ({ at: ms(e.created_at)!, text: e.text })),
    };
  }

  private toTranscript(r: Row, company: string, t?: Ticket): Transcript {
    const at = ms(r.created_at)!;
    return {
      id: r.id, ticketId: r.ticket_id, code: r.code, title: r.title, company, system: r.system, requester: r.requester,
      assignee: r.assignee, at, by: r.closed_by, txtPath: r.txt_path ?? undefined,
      // Search and the on-screen history use text rebuilt from the messages; the archived file is the download.
      text: t ? transcript(t, at) : '',
    };
  }

  private async signedUrls(paths: string[]) {
    const out = new Map<string, string>();
    for (let i = 0; i < paths.length; i += 100) {
      const { data } = await this.sb!.storage.from('attachments').createSignedUrls(paths.slice(i, i + 100), 60 * 60 * 24);
      for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
    }
    return out;
  }

  // ---------- realtime ----------
  private listening = false;
  private pending = new Set<number>();
  private timer?: ReturnType<typeof setTimeout>;

  private listen() {
    if (this.listening) return;
    this.listening = true;
    const changed = (id?: number) => {
      if (!id) return;
      this.pending.add(id);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refresh(), 300);
    };
    this.sb!.channel('aioa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (p) => {
        const row = (p.new ?? p.old) as Row;
        if (p.eventType === 'INSERT' && this.role() === 'tech' && !this.store.ticket(row.id))
          this.store.notify(row.id, `Novo chamado ${code(row as Ticket)} aberto por ${row.requester}`);
        changed(row.id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Row;
        if (this.role() === 'tech' && !AGENTS.includes(m.author)) this.store.notify(m.ticket_id, `${m.author} respondeu o chamado ${code({ id: m.ticket_id })}`);
        changed(m.ticket_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_events' }, (p) => changed((p.new as Row).ticket_id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcripts' }, () => void this.load())
      .subscribe();
  }

  /** Reloads the tickets touched by realtime events. */
  private async refresh() {
    const ids = [...this.pending];
    this.pending.clear();
    const [{ data: tickets }, { data: messages }, { data: events }] = await Promise.all([
      this.sb!.from('tickets').select('*').in('id', ids),
      this.sb!.from('messages').select('*').in('ticket_id', ids).order('created_at'),
      this.sb!.from('ticket_events').select('*').in('ticket_id', ids).order('created_at'),
    ]);
    const urls = await this.signedUrls((messages ?? []).flatMap((m) => (m.files as StoredFile[]).map((f) => f.path)));
    const nameOf = new Map([...this.companyIds].map(([n, id]) => [id, n]));
    for (const t of tickets ?? []) this.store.putTicket(this.toTicket(t, nameOf.get(t.company_id) ?? '', messages ?? [], events ?? [], urls));
  }

  // ---------- writes (Remote) ----------
  private fail(error: unknown) {
    if (!error) return;
    console.error(error);
    alert('Não foi possível salvar no servidor. Verifique a conexão e tente de novo.');
  }

  async createTicket(t: Ticket) {
    const { data, error } = await this.sb!.from('tickets')
      .insert({
        company_id: this.companyIds.get(t.company), title: t.title, description: t.description, system: t.system, category: t.category,
        subcategory: t.subcategory, priority: t.priority, status: t.status, requester: t.requester, tasks: t.tasks,
        created_at: iso(t.createdAt), updated_at: iso(t.updatedAt),
      })
      .select('id')
      .single();
    if (error) {
      this.fail(error);
      throw error;
    }
    const saved = { ...t, id: data.id as number };
    await this.addMessages(saved, t.messages);
    await this.sb!.from('ticket_events').insert(t.log.map((l) => ({ ticket_id: saved.id, text: l.text, created_at: iso(l.at) })));
    return saved.id;
  }

  /** Writes what changed between two versions of a ticket: fields, new messages, new events. */
  syncTicket(prev: Ticket, next: Ticket) {
    const cols: Row = {};
    const map: [keyof Ticket, string, (v: any) => unknown][] = [
      ['title', 'title', (v) => v], ['description', 'description', (v) => v], ['system', 'system', (v) => v],
      ['category', 'category', (v) => v], ['subcategory', 'subcategory', (v) => v], ['priority', 'priority', (v) => v],
      ['status', 'status', (v) => v], ['assignee', 'assignee', (v) => v], ['closedBy', 'closed_by', (v) => v ?? null],
      ['tasks', 'tasks', (v) => v], ['resolvedAt', 'resolved_at', iso],
    ];
    for (const [k, col, conv] of map) if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) cols[col] = conv(next[k]);
    void (async () => {
      if (Object.keys(cols).length || next.updatedAt !== prev.updatedAt)
        this.fail((await this.sb!.from('tickets').update({ ...cols, updated_at: iso(next.updatedAt) }).eq('id', next.id)).error);
      const msgs = next.messages.slice(prev.messages.length);
      if (msgs.length) await this.addMessages(next, msgs);
      const logs = next.log.slice(prev.log.length);
      if (logs.length) this.fail((await this.sb!.from('ticket_events').insert(logs.map((l) => ({ ticket_id: next.id, text: l.text, created_at: iso(l.at) })))).error);
    })();
  }

  private async addMessages(t: Ticket, msgs: Message[]) {
    const rows = [];
    for (const m of msgs) {
      const files = await Promise.all((m.files ?? []).map((f) => this.upload(t, f)));
      rows.push({ ticket_id: t.id, author: m.author, body: m.body, via: m.via ?? null, internal: !!m.internal, files, created_at: iso(m.at) });
    }
    this.fail((await this.sb!.from('messages').insert(rows)).error);
  }

  /** Data-URL attachment → Storage file; returns what the message row keeps. */
  private async upload(t: Ticket, f: Attachment): Promise<StoredFile> {
    const path = `${this.companyIds.get(t.company)}/${t.id}/${crypto.randomUUID()}-${safe(f.name)}`;
    const blob = await (await fetch(f.url)).blob();
    this.fail((await this.sb!.storage.from('attachments').upload(path, blob, { contentType: f.type })).error);
    return { name: f.name, type: f.type, size: f.size, path };
  }

  /** Archives the transcript as .txt and a self-contained .html (media embedded) in the `transcripts` bucket. */
  saveTranscript(tr: Transcript, t: Ticket) {
    void (async () => {
      const dir = `${this.companyIds.get(t.company)}/${t.id}/${tr.at}`;
      const entries = await Promise.all(
        transcriptEntries(t, tr.at).map(async (e) =>
          e.kind === 'msg' ? { ...e, files: await Promise.all(e.files.map(async (f) => ({ ...f, url: await inline(f.url) }))) } : e,
        ),
      );
      const bucket = this.sb!.storage.from('transcripts');
      const txt = await bucket.upload(`${dir}/transcricao-${tr.code}.txt`, new Blob(['﻿' + tr.text], { type: 'text/plain;charset=utf-8' }));
      const html = await bucket.upload(`${dir}/transcricao-${tr.code}.html`, new Blob([transcriptHtml(tr, entries)], { type: 'text/html;charset=utf-8' }));
      this.fail(txt.error ?? html.error);
      this.fail(
        (await this.sb!.from('transcripts').insert({
          ticket_id: t.id, company_id: this.companyIds.get(t.company), code: tr.code, title: tr.title, system: tr.system,
          requester: tr.requester, assignee: tr.assignee, closed_by: tr.by, txt_path: txt.data?.path, html_path: html.data?.path, created_at: iso(tr.at),
        })).error,
      );
    })();
  }

  /** Downloads an archived transcript file. */
  async transcriptFile(path: string) {
    const { data, error } = await this.sb!.storage.from('transcripts').download(path);
    this.fail(error);
    return data;
  }

  createCustomer(c: Customer) {
    void (async () => {
      const { data, error } = await this.sb!.from('companies')
        .insert({ name: c.name, short: c.short, contact: c.contact, email: c.email, phone: c.phone, city: c.city, since: c.since, systems: c.systems })
        .select('id')
        .single();
      if (error) return this.fail(error);
      this.companyIds.set(c.name, data.id);
      if (c.members.length)
        this.fail((await this.sb!.from('members').insert(c.members.map((m) => ({ company_id: data.id, name: m.name, email: m.email, role: m.role, since: iso(m.since) })))).error);
    })();
  }

  addMember(company: Company, m: Member) {
    void this.sb!.from('members')
      .insert({ company_id: this.companyIds.get(company), name: m.name, email: m.email, role: m.role, since: iso(m.since) })
      .then(({ error }) => this.fail(error));
  }

  removeMember(company: Company, email: string) {
    void this.sb!.from('members').delete().eq('company_id', this.companyIds.get(company)).ilike('email', email).then(({ error }) => this.fail(error));
  }

  setSystems(company: Company, systems: System[]) {
    void this.sb!.from('companies').update({ systems }).eq('id', this.companyIds.get(company)).then(({ error }) => this.fail(error));
  }
}

/** Remote file (signed URL) → data URL, so an archived HTML transcript keeps working after the link expires. */
async function inline(url: string) {
  if (!url || url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

