import { Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { AGENTS, Attachment, CATEGORIES, Category, SYSTEMS, SYSTEM_INFO, Store, System, Ticket, badge, canCustomerReply, code, fmt, isClosed } from './data';
import { Attachments, ComposerTools } from './composer';
import { Backend } from './backend';
import { Icon, Logo } from './ui';

type View = 'connecting' | 'login' | 'menu' | 'new' | 'list' | 'ticket';

/**
 * The AIOA assistant shown inside the widget (public/widget.js) on other sites such as LexFlow:
 * a small chatbot that opens a ticket step by step and then follows its conversation.
 */
@Component({
  selector: 'app-embed',
  imports: [Icon, Logo, ComposerTools, Attachments],
  template: `
    <div class="em dark-ui">
      <header class="em-head">
        @if (view() === 'ticket' || view() === 'list' || view() === 'new') {
          <button class="icon-btn" aria-label="Voltar" (click)="back()"><app-icon name="back" /></button>
        }
        <span class="em-avatar"><app-logo /></span>
        <div class="grow"><strong>Assistente AIOA</strong><small><i class="em-dot"></i> Suporte Lex</small></div>
        <button class="icon-btn" aria-label="Fechar" (click)="close()"><app-icon name="x" /></button>
      </header>

      @switch (view()) {
        @case ('connecting') {
          <div class="em-body"><div class="em-bot typing"><p>Conectando com a sua conta…</p></div></div>
        }
        @case ('login') {
          <form class="em-body em-login" (submit)="login($event)">
            <div class="em-bot typing"><p>Olá! 👋 Para abrir ou acompanhar um chamado, entre com o e-mail cadastrado pela sua empresa.</p></div>
            <input class="input" name="email" type="email" required autocomplete="username" placeholder="E-mail corporativo" />
            @if (backend.enabled) { <input class="input" name="password" type="password" required autocomplete="current-password" placeholder="Senha" /> }
            @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
            <button class="btn btn-accent" [disabled]="busy()">Entrar</button>
            @if (backend.enabled) {
              <div class="login-or"><span>ou</span></div>
              <button type="button" class="btn login-google" (click)="google()" [disabled]="busy()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                Entrar com Google
              </button>
            }
          </form>
        }

        @case ('menu') {
          <div class="em-body">
            <div class="em-bot typing"><p>Olá, {{ firstName() }}! 👋 Sou o assistente da AIOA. Como posso ajudar?</p></div>
            <div class="em-options">
              <button (click)="startNew()"><app-icon name="ticket" /> Abrir um chamado</button>
              <button (click)="view.set('list')"><app-icon name="inbox" /> Meus chamados @if (mine().length) { <em>{{ mine().length }}</em> }</button>
            </div>
          </div>
        }

        @case ('new') {
          <div #scroll class="em-body">
            <div class="em-bot typing"><p>Vamos abrir seu chamado. Sobre qual sistema é?</p></div>
            @if (draft().system; as s) {
              <div class="em-me"><p>{{ s }}</p></div>
              <div class="em-bot typing"><p>Certo! {{ info(s) }} E qual é o tipo do problema?</p></div>
            } @else {
              <div class="em-options">@for (s of systems(); track s) { <button (click)="pick('system', s)">{{ s }}<small>{{ tag(s) }}</small></button> }</div>
            }
            @if (draft().system && draft().category) {
              <div class="em-me"><p>{{ draft().category }}</p></div>
              <div class="em-bot typing"><p>Dê um título curto para o chamado.</p></div>
            } @else if (draft().system) {
              <div class="em-options">@for (c of categories; track c) { <button (click)="pick('category', c)">{{ c }}</button> }</div>
            }
            @if (draft().title) {
              <div class="em-me"><p>{{ draft().title }}</p></div>
              <div class="em-bot typing"><p>Agora descreva o que aconteceu. Você pode colar prints (Ctrl+V) ou gravar um áudio.</p></div>
            }
          </div>
          @if (draft().category && !draft().title) {
            <form class="em-composer" (submit)="setTitle($event)">
              <input class="input" name="title" required maxlength="120" placeholder="Ex.: Erro ao gerar petição" autocomplete="off" />
              <button class="btn btn-accent" aria-label="Enviar"><app-icon name="send" /></button>
            </form>
          }
          @if (draft().title) {
            @if (files().length) { <app-attachments class="em-pending" [(files)]="files" removable /> }
            <form class="em-composer" (submit)="create($event)">
              <app-composer-tools [target]="desc" [(files)]="files" />
              <textarea #desc class="input" name="description" required rows="2" placeholder="Descreva o problema…"></textarea>
              <button class="btn btn-accent" aria-label="Abrir chamado" [disabled]="busy()"><app-icon name="send" /></button>
            </form>
          }
        }

        @case ('list') {
          <div class="em-body">
            <div class="em-bot typing"><p>Estes são os seus chamados. Toque em um para ver a conversa.</p></div>
            <ul class="em-list">
              @for (t of mine(); track t.id) {
                <li><button (click)="open(t.id)">
                  <span class="grow"><b class="code">{{ code(t) }}</b> {{ t.title }}<small>{{ t.system }} · {{ fmt(t.updatedAt) }}</small></span>
                  <span [class]="badge(t.status)">{{ t.status }}</span>
                </button></li>
              } @empty {
                <li class="muted">Você ainda não abriu nenhum chamado.</li>
              }
            </ul>
            <div class="em-options"><button (click)="startNew()"><app-icon name="plus" /> Abrir um chamado</button></div>
          </div>
        }

        @case ('ticket') {
          @if (ticket(); as t) {
            <div class="em-ticket"><b class="code">{{ code(t) }}</b><span class="grow">{{ t.title }}</span><span [class]="badge(t.status)">{{ t.status }}</span></div>
            <div #scroll class="em-body">
              @for (m of messages(); track $index) {
                <div [class]="m.author === me() ? 'em-me' : 'em-bot'">
                  @if (m.author !== me()) { <b class="em-author">{{ m.author }}{{ isTeam(m.author) ? ' · Suporte AIOA' : '' }}</b> }
                  @if (m.files?.length) { <app-attachments [files]="m.files!" /> }
                  @if (m.body) { <p>{{ m.body }}</p> }
                  <small>{{ fmt(m.at) }}</small>
                </div>
              }
              @if (closed(t)) {
                <div class="em-wait em-closed"><app-icon name="lock" />
                  <p>Este chamado foi encerrado e não recebe mais respostas. Precisa de mais ajuda? Abra um novo chamado.</p></div>
                <div class="em-options"><button (click)="startNew()"><app-icon name="plus" /> Abrir um novo chamado</button></div>
              } @else if (!canReply(t)) {
                <div class="em-wait"><app-icon name="hourglass" />
                  <p>Chamado aberto! Assim que alguém da equipe AIOA iniciar o atendimento, você poderá responder por aqui.</p></div>
              }
            </div>
            @if (files().length) { <app-attachments class="em-pending" [(files)]="files" removable /> }
            <form class="em-composer" [class.locked]="!canReply(t)" (submit)="send(t, $event)">
              <app-composer-tools [target]="msg" [(files)]="files" />
              <textarea #msg class="input" name="body" rows="1" [disabled]="!canReply(t)"
                [placeholder]="closed(t) ? 'Chamado encerrado' : canReply(t) ? 'Escreva uma mensagem…' : 'Aguardando a equipe iniciar o atendimento…'"></textarea>
              <button class="btn btn-accent" aria-label="Enviar" [disabled]="!canReply(t)"><app-icon name="send" /></button>
            </form>
          }
        }
      }
    </div>
  `,
})
export class Embed {
  protected readonly store = inject(Store);
  protected readonly backend = inject(Backend);
  protected readonly code = code;
  protected readonly fmt = fmt;
  protected readonly badge = badge;
  protected readonly closed = isClosed;
  protected readonly canReply = canCustomerReply;
  protected readonly categories = Object.keys(CATEGORIES) as Category[];

  protected readonly view = signal<View>(this.store.portalUser() ? 'menu' : 'connecting');
  protected readonly ticketId = signal<number | null>(null);
  protected readonly draft = signal<{ system?: System; category?: Category; title?: string }>({});
  protected readonly files = signal<Attachment[]>([]);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected readonly me = computed(() => this.store.portalUser()?.name ?? '');
  protected readonly firstName = computed(() => this.me().split(' ')[0]);
  protected readonly systems = computed<System[]>(() => {
    const c = this.store.customers().find((x) => x.name === this.store.portalUser()?.company);
    return [...SYSTEMS.filter((s) => s !== 'Outros' && c?.systems.includes(s)), 'Outros'];
  });
  protected readonly mine = computed(() =>
    this.store.tickets().filter((t) => t.requester === this.me()).sort((a, b) => b.updatedAt - a.updatedAt),
  );
  protected readonly ticket = computed(() => this.store.tickets().find((t) => t.id === this.ticketId()));
  protected readonly messages = computed(() => this.ticket()?.messages.filter((m) => !m.internal) ?? []);
  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');

  constructor() {
    if (this.backend.enabled) void this.backend.whenReady().then((role) => this.view.set(role === 'member' ? 'menu' : 'login'));
    else if (!this.store.portalUser()) this.view.set('login');
    // Keep the newest bubble in view.
    afterRenderEffect(() => {
      this.messages().length;
      this.draft();
      const el = this.scroll()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected tag(s: System) {
    return SYSTEM_INFO[s].tag;
  }

  protected info(s: System) {
    return SYSTEM_INFO[s].text;
  }

  protected isTeam(name: string) {
    return AGENTS.includes(name) || name === this.store.user().name;
  }

  protected close() {
    parent.postMessage('aioa:close', '*');
  }

  protected back() {
    this.files.set([]);
    this.view.set(this.view() === 'ticket' ? 'list' : 'menu');
  }

  protected startNew() {
    this.draft.set({});
    this.files.set([]);
    this.view.set('new');
  }

  protected pick(key: 'system' | 'category', value: string) {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setTitle(e: Event) {
    e.preventDefault();
    const title = String(new FormData(e.target as HTMLFormElement).get('title') ?? '').trim();
    if (title) this.draft.update((d) => ({ ...d, title }));
  }

  protected open(id: number) {
    this.ticketId.set(id);
    this.files.set([]);
    this.view.set('ticket');
    this.store.markPortalSeen(`t${id}`);
  }

  protected async create(e: Event) {
    e.preventDefault();
    const description = String(new FormData(e.target as HTMLFormElement).get('description') ?? '').trim();
    const d = this.draft();
    const u = this.store.portalUser();
    if (!description || !u || !d.system || !d.category || !d.title) return;
    this.busy.set(true);
    try {
      const id = await this.store.createTicket({
        title: d.title, description, system: d.system, category: d.category, subcategory: CATEGORIES[d.category][0], priority: 'Média',
        company: u.company, requester: u.name, via: 'Portal', files: this.files(),
      });
      this.open(id);
    } finally {
      this.busy.set(false);
    }
  }

  protected send(t: Ticket, e: Event) {
    e.preventDefault();
    if (!canCustomerReply(t)) return;
    const form = e.target as HTMLFormElement;
    const ta = form.elements.namedItem('body') as HTMLTextAreaElement;
    const body = ta.value.trim();
    if (!body && !this.files().length) return;
    this.store.customerReply(t.id, body, this.files());
    this.files.set([]);
    ta.value = '';
  }

  /** Opens Google in a popup (the popup is opened right away, inside the click, so browsers don't block it). */
  protected async google() {
    this.error.set('');
    const popup = window.open('about:blank', 'aioa-google', 'width=480,height=640');
    if (!popup) return this.error.set('O navegador bloqueou a janela do Google. Permita pop-ups para este site.');
    const { data, error } = await this.backend.googlePopupUrl();
    if (error || !data.url) {
      popup.close();
      return this.error.set('Não foi possível entrar com o Google.');
    }
    popup.location.href = data.url;
    this.busy.set(true);
    const onMessage = async (ev: MessageEvent) => {
      if (ev.source !== popup || ev.origin !== location.origin || ev.data?.type !== 'aioa:session') return;
      removeEventListener('message', onMessage);
      await this.backend.setSession(ev.data.access_token, ev.data.refresh_token);
      const role = await this.backend.whenReady();
      this.busy.set(false);
      if (role === 'member') this.view.set('menu');
      else {
        this.error.set(role === 'tech'
          ? 'Esta conta é da equipe AIOA. O assistente é para clientes: entre com o e-mail de um membro de empresa cliente.'
          : 'Esta conta Google não tem acesso. Peça à equipe AIOA para cadastrar seu e-mail como membro da sua empresa.');
        await this.backend.signOut();
      }
    };
    addEventListener('message', onMessage);
    // Closed without finishing: re-enable the buttons.
    const watch = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(watch);
      setTimeout(() => this.busy.set(false), 500);
    }, 500);
  }

  protected async login(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const email = String(f.get('email')).trim().toLowerCase();
    this.error.set('');
    if (!this.backend.enabled) {
      // Demo mode: any registered, active member e-mail.
      for (const c of this.store.customers()) {
        const m = c.members.find((x) => x.email.toLowerCase() === email && x.active !== false);
        if (m && c.active !== false) {
          this.store.portalLogin({ company: c.name, name: m.name });
          return this.view.set('menu');
        }
      }
      return this.error.set('E-mail não cadastrado ou sem acesso.');
    }
    this.busy.set(true);
    const { error } = await this.backend.signIn(email, String(f.get('password') ?? ''));
    const role = error ? null : await this.backend.whenReady();
    this.busy.set(false);
    if (role === 'member') this.view.set('menu');
    else {
      this.error.set(error ? 'E-mail ou senha incorretos.' : role === 'tech' ? 'Esta conta é da equipe AIOA. O assistente é para clientes: entre com o e-mail de um membro de empresa cliente.' : 'Este acesso é para clientes. Peça à equipe AIOA para cadastrar você.');
      if (!error) await this.backend.signOut();
    }
  }
}
