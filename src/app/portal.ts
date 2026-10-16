import { Component, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { CanActivateFn, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AGENTS, Article, Attachment, COMPANIES, Company, PEOPLE, PRIORITIES, Priority, SYSTEMS, Store, System, ago, badge, code, fmt, initials, isClosed } from './data';
import { Attachments, ComposerTools } from './composer';
import { Icon, Logo } from './ui';

/** Portal pages need a (simulated) customer login. */
export const portalGuard: CanActivateFn = () =>
  inject(Store).portalUser() ? true : inject(Router).parseUrl('/portal/login');

const words = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];

/** Articles whose words overlap what the customer is typing; title matches count double. */
export function suggest(articles: Article[], text: string, system?: string, max = 3) {
  const typed = new Set(words(text));
  if (typed.size < 2) return [];
  return articles
    .map((a) => {
      const hits = (ws: string[]) => new Set(ws.filter((w) => typed.has(w))).size;
      return { a, score: hits(words(a.title)) * 2 + hits(words(`${a.summary} ${a.body}`)) + (a.system === system ? 1 : 0) };
    })
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.a);
}

@Component({
  selector: 'app-portal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, Icon],
  template: `
    <header class="portal-top">
      <a routerLink="/portal" class="brand" aria-label="AIOA"><app-logo /><span class="wordmark">ΛIOΛ</span><span class="portal-tag">Suporte</span></a>
      <nav class="portal-nav">
        <a routerLink="/portal" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Meus chamados</a>
        <a routerLink="/portal/novo" routerLinkActive="active">Abrir chamado</a>
        <a routerLink="/portal/kb" routerLinkActive="active">Base de conhecimento</a>
      </nav>
      @if (store.portalUser(); as u) {
        <div class="portal-user">
          <span class="avatar sm">{{ initials(u.name) }}</span>
          <div class="who"><strong>{{ u.name }}</strong><small>{{ u.company }}</small></div>
          <button class="icon-btn" aria-label="Sair" title="Sair" (click)="logout()"><app-icon name="back" /></button>
        </div>
      }
    </header>
    <main class="portal-main"><router-outlet /></main>
  `,
})
export class PortalLayout {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly initials = initials;

  logout() {
    this.store.portalLogin(null);
    this.router.navigate(['/portal/login']);
  }
}

@Component({
  selector: 'app-portal-login',
  imports: [Logo, RouterLink],
  template: `
    <div class="portal-login">
      <form class="card card-body login-card" (submit)="enter($event)">
        <div class="brand"><app-logo /><span class="wordmark">ΛIOΛ</span></div>
        <div>
          <h1>Portal do cliente</h1>
          <p class="muted">Abra e acompanhe seus chamados de suporte dos sistemas Lex.</p>
        </div>
        <label class="field">Empresa
          <select #co class="input" name="company" (change)="company.set($any(co.value))">
            @for (c of companies; track c) { <option [selected]="c === company()">{{ c }}</option> }
          </select>
        </label>
        <label class="field">Seu nome
          <input class="input" name="name" required [value]="contact()" />
        </label>
        <button class="btn btn-primary">Entrar</button>
        <small class="muted">Protótipo: o login é simulado, sem senha.</small>
        <a class="muted login-back" routerLink="/dashboard">← Voltar ao painel da equipe AIOA</a>
      </form>
    </div>
  `,
})
export class PortalLogin {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly companies = COMPANIES;
  protected readonly company = signal<Company>(this.store.portalUser()?.company ?? COMPANIES[0]);
  protected readonly contact = computed(() => PEOPLE.find((p) => p.org === this.company())!.name);

  enter(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    this.store.portalLogin({ company: f.get('company') as Company, name: String(f.get('name')).trim() });
    this.router.navigate(['/portal']);
  }
}

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, Icon],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">{{ user().company }}</span><h1>Olá, {{ user().name.split(' ')[0] }}!</h1>
          <p>Acompanhe aqui os chamados da sua empresa.</p></div>
        <a class="btn btn-primary" routerLink="/portal/novo"><app-icon name="plus" /> Abrir chamado</a>
      </div>

      <div class="seg" role="tablist" aria-label="Filtro">
        <button role="tab" [attr.aria-selected]="!closed()" [class.on]="!closed()" (click)="closed.set(false)">Em aberto ({{ counts().open }})</button>
        <button role="tab" [attr.aria-selected]="closed()" [class.on]="closed()" (click)="closed.set(true)">Resolvidos ({{ counts().closed }})</button>
      </div>

      <div class="card">
        <ul class="list tickets">
          @for (t of list(); track t.id) {
            <li class="clickable" [routerLink]="['/portal/chamados', t.id]">
              <div class="grow">
                <div class="t-head"><b class="code">{{ code(t) }}</b><strong>{{ t.title }}</strong></div>
                <p class="t-desc">{{ last(t) }}</p>
                <small class="muted">{{ t.system }} · aberto por {{ t.requester }} · atualizado {{ ago(t.updatedAt) }}</small>
              </div>
              <div class="t-side">
                <span [class]="badge(t.status)">{{ t.status === 'Aguardando cliente' ? 'Aguardando você' : t.status }}</span>
              </div>
            </li>
          } @empty {
            <li class="empty">{{ closed() ? 'Nenhum chamado resolvido ainda.' : 'Nenhum chamado em aberto. 🎉' }}</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class PortalHome {
  private readonly store = inject(Store);
  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly closed = signal(false);
  protected readonly user = computed(() => this.store.portalUser()!);

  private readonly mine = computed(() => this.store.tickets().filter((t) => t.company === this.user().company));
  protected readonly counts = computed(() => ({
    open: this.mine().filter((t) => !isClosed(t)).length,
    closed: this.mine().filter(isClosed).length,
  }));
  protected readonly list = computed(() =>
    this.mine().filter((t) => isClosed(t) === this.closed()).sort((a, b) => b.updatedAt - a.updatedAt),
  );

  protected last(t: { messages: { author: string; body: string; internal?: boolean }[] }) {
    const m = t.messages.filter((x) => !x.internal).at(-1);
    return m ? `${m.author}: ${m.body || '📎 Anexo'}` : '';
  }
}

@Component({
  selector: 'app-portal-new',
  imports: [RouterLink, Icon, ComposerTools, Attachments],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Suporte</span><h1>Abrir chamado</h1>
          <p>Conte o que está acontecendo. Quanto mais detalhes, mais rápido conseguimos ajudar.</p></div>
      </div>

      <div class="portal-new">
        <form class="card card-body form" (submit)="create($event)">
          <label class="field">Sistema
            <select #sy class="input" name="system" (change)="system.set(sy.value)">
              @for (s of systems; track s) { <option>{{ s }}</option> }
            </select>
          </label>
          <label class="field">Urgência
            <select class="input" name="priority">
              @for (p of priorities; track p) { <option [selected]="p === 'Média'">{{ p }}</option> }
            </select>
          </label>
          <label class="field full">Assunto
            <input #ti class="input" name="title" required maxlength="120" placeholder="Ex.: Erro ao gerar petição" (input)="title.set(ti.value)" />
          </label>
          <label class="field full">Descrição
            <textarea #de class="input" name="description" required rows="6"
              placeholder="O que você estava fazendo, o que aconteceu e o que esperava que acontecesse."
              (input)="description.set(de.value)"></textarea>
          </label>
          <div class="full">
            @if (files().length) { <app-attachments [(files)]="files" removable /> }
            <div class="new-foot">
              <app-composer-tools [target]="de" [(files)]="files" />
              <button class="btn btn-primary">Abrir chamado</button>
            </div>
          </div>
        </form>

        <aside class="card card-body kb-suggest" aria-live="polite">
          <span class="eyebrow"><app-icon name="book" /> Isso pode ajudar</span>
          @for (a of suggestions(); track a.id) {
            <a class="suggest-item" [routerLink]="['/portal/kb', a.id]" target="_blank">
              <span class="badge">{{ a.system }}</span>
              <strong>{{ a.title }}</strong>
              <small class="muted">{{ a.summary }}</small>
            </a>
          } @empty {
            <p class="muted">Comece a descrever o problema e mostramos artigos da base de conhecimento que podem resolver na hora.</p>
          }
        </aside>
      </div>
    </div>
  `,
})
export class PortalNew {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly systems = SYSTEMS;
  protected readonly priorities = PRIORITIES;
  protected readonly system = signal<string>(SYSTEMS[0]);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly files = signal<Attachment[]>([]);
  protected readonly suggestions = computed(() =>
    suggest(this.store.articles(), `${this.title()} ${this.description()}`, this.system()),
  );

  create(e: Event) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement)) as Record<string, string>;
    const u = this.store.portalUser()!;
    const id = this.store.createTicket({
      title: f['title'].trim(),
      description: f['description'].trim(),
      system: f['system'] as System,
      priority: f['priority'] as Priority,
      company: u.company,
      requester: u.name,
      via: 'Portal',
      files: this.files(),
    });
    this.router.navigate(['/portal/chamados', id]);
  }
}

@Component({
  selector: 'app-portal-ticket',
  imports: [RouterLink, Icon, ComposerTools, Attachments],
  template: `
    @if (ticket(); as t) {
      <div class="page narrow portal-ticket">
        <a routerLink="/portal" class="back"><app-icon name="back" /> Meus chamados</a>
        <div class="card">
          <header class="card-head">
            <div>
              <div class="t-head"><b class="code">{{ code(t) }}</b><h2>{{ t.title }}</h2></div>
              <small class="muted">{{ t.system }} · aberto por {{ t.requester }} em {{ fmt(t.createdAt) }}</small>
            </div>
            <span [class]="badge(t.status)">{{ t.status === 'Aguardando cliente' ? 'Aguardando você' : t.status }}</span>
          </header>

          <div #scroller class="portal-thread">
            <ol class="timeline">
              @for (m of messages(); track $index) {
                <li class="msg">
                  <span class="avatar sm" [class.agent]="isTeam(m.author)">{{ initials(m.author) }}</span>
                  <div>
                    <header><strong>{{ isTeam(m.author) ? m.author + ' · Suporte AIOA' : m.author }}</strong>
                      <small class="muted">· {{ fmt(m.at) }}</small></header>
                    @if (m.body) { <p>{{ m.body }}</p> }
                    @if (m.files?.length) { <app-attachments [files]="m.files!" /> }
                  </div>
                </li>
              }
            </ol>
          </div>

          <form class="composer" (submit)="send(t.id, $event)">
            <span class="avatar sm">{{ initials(me()) }}</span>
            <div class="box">
              @if (files().length) { <app-attachments [(files)]="files" removable /> }
              <textarea #ta name="body" rows="2" (keydown.control.enter)="submit($event)"
                [placeholder]="closed(t) ? 'Responder reabre o chamado…' : 'Escreva uma mensagem para o suporte…'"></textarea>
              <div class="cmp-foot">
                <app-composer-tools [target]="ta" [(files)]="files" />
                <button class="btn btn-primary" title="Ctrl + Enter">Enviar</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    } @else {
      <div class="page"><div class="empty">Chamado não encontrado. <a routerLink="/portal">Voltar</a></div></div>
    }
  `,
})
export class PortalTicket {
  readonly id = input.required<string>();
  private readonly store = inject(Store);
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly closed = isClosed;
  protected readonly files = signal<Attachment[]>([]);
  protected readonly me = computed(() => this.store.portalUser()!.name);

  /** Only the signed-in company's tickets, and never the team's internal notes. */
  protected readonly ticket = computed(() => {
    const t = this.store.ticket(Number(this.id()));
    return t && t.company === this.store.portalUser()?.company ? t : undefined;
  });
  protected readonly messages = computed(() => this.ticket()?.messages.filter((m) => !m.internal) ?? []);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    afterRenderEffect(() => {
      this.messages().length;
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected isTeam(name: string) {
    return AGENTS.includes(name) || name === this.store.user().name;
  }

  protected submit(e: Event) {
    e.preventDefault();
    (e.target as HTMLTextAreaElement).form?.requestSubmit();
  }

  protected send(id: number, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const ta = form.elements.namedItem('body') as HTMLTextAreaElement;
    const body = ta.value.trim();
    if (!body && !this.files().length) return;
    this.store.customerReply(id, body, this.files());
    this.files.set([]);
    ta.value = '';
  }
}
