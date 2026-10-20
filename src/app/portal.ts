import { Component, DestroyRef, ElementRef, OnInit, afterNextRender, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { CanActivateFn, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AGENTS, Article, Attachment, CATEGORIES, Category, Company, SYSTEMS, SYSTEM_INFO, Store, System, Ticket, canCustomerReply, staffEmail, ago, badge, code, fmt, initials, isClosed } from './data';
import { Attachments, ComposerTools } from './composer';
import { Icon, Logo } from './ui';
import { Select, toOptions } from './select';
import { Backend } from './backend';

/** Portal pages need a signed-in customer member (Supabase) or, in demo mode, a simulated login. */
export const portalGuard: CanActivateFn = async () => {
  const backend = inject(Backend);
  const router = inject(Router);
  if (backend.enabled) return (await backend.whenReady()) === 'member' || router.parseUrl('/login');
  const store = inject(Store);
  const u = store.portalUser();
  const member = u && store.customers().find((c) => c.name === u.company)?.members.some((m) => m.name === u.name);
  return member ? true : inject(Router).parseUrl('/login');
};

/** Support team authors (anyone else in a ticket is from the customer's company). */
const isTeam = (store: Store, name: string) => AGENTS.includes(name) || name === store.user().name;

export interface PortalNotice {
  at: number;
  icon: string;
  text: string;
  link: (string | number)[];
}

/**
 * What's new for the signed-in customer, derived from data (nothing extra is stored): support replies,
 * status changes and tickets opened by colleagues on the company's tickets, plus support messages in the Inbox.
 */
export function portalNotices(store: Store): PortalNotice[] {
  const u = store.portalUser();
  if (!u) return [];
  const out: PortalNotice[] = [];
  for (const t of store.tickets()) {
    if (t.company !== u.company) continue;
    const link = ['/portal/chamados', t.id];
    if (t.requester !== u.name) out.push({ at: t.createdAt, icon: 'ticket', text: `${t.requester} abriu ${code(t)} · ${t.title}`, link });
    for (const m of t.messages) {
      if (m.internal || m.author === u.name || m.at === t.createdAt) continue;
      const what = isTeam(store, m.author) ? 'respondeu' : 'comentou em';
      out.push({ at: m.at, icon: 'forum', text: `${m.author} ${what} ${code(t)}: ${m.body || '📎 Anexo'}`, link });
    }
    for (const l of t.log) out.push({ at: l.at, icon: 'clock', text: `${code(t)} · ${l.text}`, link });
  }
  for (const m of store.customerConversation()?.messages ?? []) {
    if (m.author !== u.name) out.push({ at: m.at, icon: 'inbox', text: `${m.author} enviou uma mensagem: ${m.body || '📎 Anexo'}`, link: ['/portal/inbox'] });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 80);
}

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
    <div class="portal dark-ui">
    <header class="portal-top">
      <a routerLink="/portal" class="brand" aria-label="AIOA"><app-logo /><span class="wordmark">ΛIOΛ</span><span class="portal-tag">Suporte</span></a>
      <nav class="portal-nav">
        <a routerLink="/portal" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Meus chamados</a>
        <a routerLink="/portal/novo" routerLinkActive="active">Abrir chamado</a>
        <a routerLink="/portal/inbox" routerLinkActive="active">Inbox @if (unreadInbox()) { <em class="count">{{ unreadInbox() }}</em> }</a>
        <a routerLink="/portal/forum" routerLinkActive="active">Fórum</a>
        <a routerLink="/portal/historico" routerLinkActive="active">Histórico</a>
        <a routerLink="/portal/kb" routerLinkActive="active">Base de conhecimento</a>
      </nav>
      @if (store.portalUser(); as u) {
        <a class="icon-btn portal-bell" routerLink="/portal/notificacoes" routerLinkActive="active" aria-label="Notificações" title="Notificações">
          <app-icon name="bell" />
          @if (unreadNotices()) { <em class="count">{{ unreadNotices() > 9 ? "9+" : unreadNotices() }}</em> }
        </a>
        <div class="portal-user">
          <span class="avatar sm">{{ initials(u.name) }}</span>
          <div class="who"><strong>{{ u.name }}</strong><small>{{ u.company }}</small></div>
          <button class="icon-btn portal-logout" aria-label="Sair do portal" data-tip="Sair do portal e voltar ao login" (click)="logout()"><app-icon name="back" /></button>
        </div>
      }
    </header>
    <main class="portal-main"><router-outlet /></main>
    </div>
  `,
})
export class PortalLayout {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly initials = initials;
  protected readonly unreadNotices = computed(() => {
    const seen = this.store.portalSeenAt('notices');
    return portalNotices(this.store).filter((n) => n.at > seen).length;
  });
  protected readonly unreadInbox = computed(() => {
    const seen = this.store.portalSeenAt('inbox');
    const me = this.store.portalUser()?.name;
    return (this.store.customerConversation()?.messages ?? []).filter((m) => m.author !== me && m.at > seen).length;
  });

  private readonly backend = inject(Backend);

  async logout() {
    if (this.backend.enabled) await this.backend.signOut();
    this.store.portalLogin(null);
    this.router.navigate(['/login']);
  }
}



const PHRASES = [
  ['Todo chamado,', 'em um só lugar.'],
  ['Do primeiro print', 'à transcrição final.'],
  ['Cinco sistemas.', 'Um só suporte.'],
  ['Resposta, ligação ou vídeo,', 'na mesma conversa.'],
  ['Seu suporte,', 'sem trocar de tela.'],
] as const;

/**
 * Sign-in for both audiences: customers (Usuário → portal) and the support team (Membro Tech → dashboard).
 * 70% shows the institutional site's animated background with rotating phrases, 30% holds the form.
 */
@Component({
  selector: 'app-portal-login',
  imports: [Logo, Icon, RouterLink],
  template: `
    <div class="login">
      <section class="login-art">
        <a routerLink="/" class="brand" aria-label="Voltar ao site"><app-logo /><span class="wordmark">ΛIOΛ</span></a>
        <div class="login-copy" aria-live="polite">
          @for (p of [phrases[phrase()]]; track phrase()) {
            <h2>{{ p[0] }}<br /><span>{{ p[1] }}</span></h2>
          }
          <p>Suporte para LexFlow, LexÁgile, LexHub, LexPré e LexChat.</p>
          <div class="login-dots">
            @for (p of phrases; track $index) {
              <button [class.on]="$index === phrase()" [attr.aria-label]="'Frase ' + ($index + 1)" (click)="phrase.set($index)"></button>
            }
          </div>
        </div>
      </section>

      <section class="login-panel dark-ui">
        <form class="login-form" (submit)="enter($event)">
          <div class="login-brand"><app-logo /><span class="wordmark">ΛIOΛ</span></div>

          <div class="seg view-toggle login-tabs" role="tablist" aria-label="Tipo de acesso">
            <button type="button" role="tab" [attr.aria-selected]="tab() === 'user'" [class.on]="tab() === 'user'" (click)="switchTab('user')"><app-icon name="users" /> Usuário</button>
            <button type="button" role="tab" [attr.aria-selected]="tab() === 'tech'" [class.on]="tab() === 'tech'" (click)="switchTab('tech')"><app-icon name="headset" /> Membro Tech</button>
          </div>

          <label class="field">E-mail<input class="input" name="email" type="email" required autocomplete="username" placeholder="E-mail corporativo" /></label>
          @if (mode() !== 'reset') {
            <label class="field">Senha<input class="input" name="password" type="password" required minlength="6"
              [attr.autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'" placeholder="Senha" /></label>
          }
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          @if (info()) { <p class="login-info" role="status">{{ info() }}</p> }
          <button class="btn btn-accent" [disabled]="busy()">
            {{ mode() === 'signup' ? 'Criar acesso' : mode() === 'reset' ? 'Enviar link' : 'Entrar' }} <app-icon name="chevron-right" />
          </button>

          @if (backend.enabled) {
            @if (mode() === 'login') {
              <div class="login-or"><span>ou</span></div>
              <button type="button" class="btn login-google" (click)="google()" [disabled]="busy()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Entrar com Google
              </button>
            }
            <div class="login-links">
              @if (mode() === 'login') {
                <button type="button" (click)="setMode('signup')">Primeiro acesso</button>
                <button type="button" (click)="setMode('reset')">Esqueci a senha</button>
              } @else {
                <button type="button" (click)="setMode('login')">← Voltar para entrar</button>
              }
            </div>
          }

          @if (mode() === 'login') { <a class="muted login-back" routerLink="/">← Voltar ao site</a> }
        </form>
      </section>
    </div>
  `,
})
export class PortalLogin {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly phrases = PHRASES;
  protected readonly phrase = signal(0);
  protected readonly tab = signal<'user' | 'tech'>('user');
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly busy = signal(false);
  protected readonly mode = signal<'login' | 'signup' | 'reset'>('login');
  protected readonly backend = inject(Backend);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Back from Google (or already signed in): go straight to the right area.
    if (this.backend.enabled) void this.backend.whenReady().then((role) => role && this.route(role));
    afterNextRender(() => {
      const timer = setInterval(() => this.phrase.update((i) => (i + 1) % PHRASES.length), 4000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  protected switchTab(t: 'user' | 'tech') {
    this.tab.set(t);
    this.error.set('');
  }

  protected setMode(m: 'login' | 'signup' | 'reset') {
    this.mode.set(m);
    this.error.set('');
    this.info.set('');
  }

  private route(role: 'tech' | 'member') {
    this.router.navigate([role === 'tech' ? '/dashboard' : '/portal']);
  }

  protected async google() {
    this.busy.set(true);
    const { error } = await this.backend.google();
    if (error) this.error.set('Não foi possível entrar com o Google.');
    this.busy.set(false);
  }

  /** Supabase Auth: sign in, create the password on first access, or reset it. */
  private async enterRemote(email: string, password: string) {
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    try {
      if (this.mode() === 'reset') {
        const { error } = await this.backend.resetPassword(email);
        if (error) throw error;
        this.info.set('Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.');
        return;
      }
      if (this.mode() === 'signup') {
        const { data, error } = await this.backend.signUp(email, password);
        if (error) throw error;
        if (!data.session) return this.info.set('Enviamos um e-mail de confirmação. Depois de confirmar, entre com sua senha.');
      } else {
        const { error } = await this.backend.signIn(email, password);
        if (error) throw error;
      }
      const role = await this.backend.whenReady();
      if (role) this.route(role);
      else {
        this.error.set('Seu e-mail não tem acesso. Peça à equipe AIOA para cadastrar você como membro da sua empresa.');
        await this.backend.signOut();
      }
    } catch (err) {
      const msg = (err as { message?: string }).message ?? '';
      this.error.set(/invalid login/i.test(msg) ? 'E-mail ou senha incorretos.' : /registered/i.test(msg) ? 'Este e-mail já tem acesso. Entre com sua senha.' : 'Não foi possível concluir. Tente de novo.');
    } finally {
      this.busy.set(false);
    }
  }

  // Demo mode (no Supabase configured): simulated auth, the password isn't checked.
  enter(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const email = String(f.get('email')).trim().toLowerCase();
    if (this.backend.enabled) return void this.enterRemote(email, String(f.get('password') ?? ''));
    if (this.tab() === 'tech') {
      const name = AGENTS.find((a) => staffEmail(a) === email);
      if (!name) return this.error.set('E-mail não encontrado na equipe AIOA.');
      // Keeps the saved role when the same person signs in again.
      if (name !== this.store.user().name) this.store.setUser({ name, role: 'Analista de suporte' });
      this.router.navigate(['/dashboard']);
      return;
    }
    for (const c of this.store.customers()) {
      const m = c.members.find((x) => x.email.toLowerCase() === email);
      if (m && (m.active === false || c.active === false)) return this.error.set('Seu acesso está desativado. Fale com a equipe AIOA.');
      if (m) {
        this.store.portalLogin({ company: c.name, name: m.name });
        this.router.navigate(['/portal']);
        return;
      }
    }
    this.error.set('E-mail não cadastrado. Peça à equipe AIOA para incluir você como membro da sua empresa.');
  }
}

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, Icon],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div><span class="eyebrow">{{ user().company }}</span><h1>Olá, {{ user().name.split(' ')[0] }}!</h1>
          <p>Acompanhe aqui os chamados da sua empresa.</p></div>
        <a class="btn btn-accent" routerLink="/portal/novo"><app-icon name="plus" /> Abrir chamado</a>
      </div>

      <div class="seg view-toggle portal-filter" role="tablist" aria-label="Filtro">
        <button role="tab" [attr.aria-selected]="!closed()" [class.on]="!closed()" (click)="closed.set(false)">Em aberto ({{ counts().open }})</button>
        <button role="tab" [attr.aria-selected]="closed()" [class.on]="closed()" (click)="closed.set(true)">Encerrados ({{ counts().closed }})</button>
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
                <span class="row-bell" [class.on]="fresh(t)" [attr.title]="fresh(t) ? 'Nova resposta do suporte' : 'Sem novidades'" [attr.aria-label]="fresh(t) ? 'Nova resposta do suporte' : 'Sem novidades'"><app-icon name="bell" /></span>
                <span [class]="badge(t.status)">{{ t.status === 'Aguardando cliente' ? 'Aguardando você' : t.status }}</span>
              </div>
            </li>
          } @empty {
            <li class="empty">{{ closed() ? 'Nenhum chamado encerrado ainda.' : 'Nenhum chamado em aberto. 🎉' }}</li>
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

  /** A support reply the customer hasn't opened yet. */
  protected fresh(t: Ticket) {
    const reply = t.messages.filter((m) => !m.internal && isTeam(this.store, m.author)).at(-1);
    return !!reply && reply.at > this.store.portalSeenAt(`t${t.id}`);
  }

  protected last(t: { messages: { author: string; body: string; internal?: boolean }[] }) {
    const m = t.messages.filter((x) => !x.internal).at(-1);
    return m ? `${m.author}: ${m.body || '📎 Anexo'}` : '';
  }
}

@Component({
  selector: 'app-portal-new',
  imports: [RouterLink, Icon, ComposerTools, Attachments, Select],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div><span class="eyebrow">Suporte</span><h1>Abrir chamado</h1>
          <p>Conte o que está acontecendo. Quanto mais detalhes, mais rápido conseguimos ajudar.</p></div>
      </div>

      <div class="portal-new">
        <form class="card card-body form" (submit)="create($event)">
          <label class="field">Sistema
            <app-select name="system" label="Sistema" [options]="systemOptions()" [(value)]="system" />
          </label>
          <label class="field">Categoria
            <app-select name="category" label="Categoria" [options]="categoryOptions" [value]="categories[0]" />
          </label>
          <label class="field full">Assunto
            <input #ti class="input" name="title" required maxlength="120" placeholder="Ex.: Erro ao gerar petição" (input)="title.set(ti.value)" />
          </label>
          <label class="field full">Descrição
            <textarea #de class="input" name="description" required rows="6"
              placeholder="O que você estava fazendo, o que aconteceu e o que esperava que acontecesse. Você pode colar um print direto aqui (Ctrl+V)."
              (input)="description.set(de.value)"></textarea>
          </label>
          <div class="full">
            @if (files().length) { <app-attachments [(files)]="files" removable /> }
            <div class="new-foot">
              <app-composer-tools [target]="de" [(files)]="files" />
              <button class="btn btn-accent">Abrir chamado</button>
            </div>
          </div>
        </form>

        <div class="portal-rail">
        @if (systemInfo(); as info) {
          <aside class="card card-body sys-info" aria-live="polite">
            <span class="eyebrow"><app-icon name="info" /> Sobre o sistema</span>
            <div class="sys-info-head"><strong>{{ system() }}</strong><small class="badge">{{ info.tag }}</small></div>
            <p class="muted">{{ info.text }}</p>
            <ul>@for (it of info.items; track it) { <li><app-icon name="check" /> {{ it }}</li> }</ul>
          </aside>
        }
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
    </div>
  `,
})
export class PortalNew {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  /** Only the systems the user's company has contracted, plus "Outros". */
  protected readonly systems = computed<System[]>(() => {
    const c = this.store.customers().find((x) => x.name === this.store.portalUser()?.company);
    return [...SYSTEMS.filter((s) => s !== 'Outros' && c?.systems.includes(s)), 'Outros'];
  });
  protected readonly categories = Object.keys(CATEGORIES) as Category[];
  protected readonly categoryOptions = toOptions(this.categories);
  protected readonly systemOptions = computed(() => this.systems().map((s) => ({ value: s, label: s, hint: SYSTEM_INFO[s].tag })));
  protected readonly systemInfo = computed(() => SYSTEM_INFO[this.system() as System]);
  protected readonly system = signal<string>(this.systems()[0]);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly files = signal<Attachment[]>([]);
  protected readonly suggestions = computed(() =>
    suggest(this.store.articles(), `${this.title()} ${this.description()}`, this.system()),
  );

  async create(e: Event) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement)) as Record<string, string>;
    const u = this.store.portalUser()!;
    const id = await this.store.createTicket({
      title: f['title'].trim(),
      description: f['description'].trim(),
      system: f['system'] as System,
      category: f['category'] as Category,
      // The customer no longer picks these; the team adjusts them in the ticket.
      subcategory: CATEGORIES[f['category'] as Category][0],
      priority: 'Média',
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
      <div class="page wide portal-ticket">
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
              <textarea #ta name="body" rows="2" (keydown.control.enter)="submit($event)" [disabled]="!canReply(t)"
                [placeholder]="closed(t) ? 'Chamado encerrado: para um novo problema, abra um novo chamado.' : !canReply(t) ? 'Aguardando a equipe AIOA iniciar o atendimento para você poder responder…' : 'Escreva uma mensagem para o suporte…'"></textarea>
              <div class="cmp-foot">
                <app-composer-tools [target]="ta" [(files)]="files" />
                <button class="btn btn-accent" title="Ctrl + Enter" [disabled]="!canReply(t)">Enviar</button>
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
export class PortalTicket implements OnInit {
  readonly id = input.required<string>();
  private readonly store = inject(Store);
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly closed = isClosed;
  protected readonly canReply = canCustomerReply;
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

  ngOnInit() {
    this.store.markPortalSeen(`t${this.id()}`);
  }

  protected isTeam(name: string) {
    return isTeam(this.store, name);
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
    const t = this.ticket();
    if (!t || !canCustomerReply(t) || (!body && !this.files().length)) return;
    this.store.customerReply(id, body, this.files());
    this.files.set([]);
    ta.value = '';
  }
}

@Component({
  selector: 'app-portal-notifications',
  imports: [RouterLink, Icon],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div><span class="eyebrow">{{ store.portalUser()?.company }}</span><h1>Notificações</h1>
          <p>Respostas do suporte, mudanças de status e chamados abertos pelos colegas da sua empresa.</p></div>
      </div>
      <div class="card">
        <ul class="list portal-notices">
          @for (n of notices(); track $index) {
            <li class="clickable" [class.unread]="n.at > seenAt" [routerLink]="n.link">
              <span class="ev-icon"><app-icon [name]="n.icon" /></span>
              <span class="grow">{{ n.text }}</span>
              <small class="muted">{{ ago(n.at) }}</small>
              @if (n.at > seenAt) { <span class="unread-dot"></span> }
            </li>
          } @empty {
            <li class="empty">Nenhuma notificação ainda.</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class PortalNotifications {
  protected readonly store = inject(Store);
  protected readonly ago = ago;
  protected readonly notices = computed(() => portalNotices(this.store));
  /** Captured before marking as seen, so this visit still highlights what's new. */
  protected readonly seenAt = this.store.portalSeenAt('notices');

  constructor() {
    this.store.markPortalSeen('notices');
  }
}

@Component({
  selector: 'app-portal-inbox',
  imports: [Icon, ComposerTools, Attachments],
  template: `
    <div class="page wide portal-inbox">
      <div class="page-head">
        <div><span class="eyebrow">Inbox</span><h1>Fale com o suporte</h1>
          <p>Uma conversa direta com a equipe AIOA, fora dos chamados.</p></div>
      </div>
      <section class="card dm-chat">
        <header class="dm-chat-head">
          <span class="avatar agent"><app-icon name="headset" /></span>
          <div class="grow"><strong>Equipe AIOA</strong><br /><small class="muted">Suporte · respondemos em horário comercial</small></div>
        </header>
        <div #thread class="dm-thread">
          @for (m of messages(); track $index) {
            <div class="bubble" [class.mine]="m.author === me()">
              @if (m.author !== me()) { <b class="bubble-author">{{ m.author }}</b> }
              @if (m.files?.length) { <app-attachments [files]="m.files!" /> }
              @if (m.body) { <p>{{ m.body }}</p> }
              <small>{{ fmt(m.at) }}</small>
            </div>
          } @empty {
            <p class="empty dm-placeholder">Mande uma mensagem para a equipe de suporte 👋</p>
          }
        </div>
        @if (files().length) {
          <app-attachments class="dm-pending" [(files)]="files" removable />
        }
        <form class="dm-composer" (submit)="send($event)">
          <app-composer-tools [target]="msg" [(files)]="files" />
          <input #msg class="input" name="body" autocomplete="off" placeholder="Mensagem para a equipe AIOA… (cole prints com Ctrl+V)" />
          <button class="btn btn-accent" aria-label="Enviar"><app-icon name="send" /></button>
        </form>
      </section>
    </div>
  `,
})
export class PortalInbox {
  private readonly store = inject(Store);
  protected readonly fmt = fmt;
  protected readonly files = signal<Attachment[]>([]);
  protected readonly me = computed(() => this.store.portalUser()?.name ?? '');
  protected readonly messages = computed(() => this.store.customerConversation()?.messages ?? []);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    this.store.markPortalSeen('inbox');
    afterRenderEffect(() => {
      this.messages().length;
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected send(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('body') as HTMLInputElement;
    const body = input.value.trim();
    if (!body && !this.files().length) return;
    this.store.customerDm(body, this.files());
    this.store.markPortalSeen('inbox');
    this.files.set([]);
    input.value = '';
  }
}
