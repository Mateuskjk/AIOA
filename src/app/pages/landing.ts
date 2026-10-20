import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SYSTEMS as SYSTEMS_LIST, SYSTEM_INFO, Store, code, isClosed, kpiStats } from '../data';
import { Icon, Logo } from '../ui';

const FEATURES = [
  { icon: 'ticket', title: 'Tickets com SLA', text: 'Cada chamado ganha código A-, prioridade, responsável e prazo. Lista ou kanban, com abas por empresa.' },
  { icon: 'inbox', title: 'Inbox', text: 'Conversas diretas com a equipe e com clientes, fora do ticket, com anexos, emoji e áudio.' },
  { icon: 'video', title: 'Chamadas de voz e vídeo', text: 'Ligue para o cliente de dentro do chamado, com compartilhamento de tela.' },
  { icon: 'history', title: 'Transcrição automática', text: 'Ao encerrar, a conversa inteira — texto, imagens e áudios — vai para o Histórico de tickets.' },
  { icon: 'book', title: 'Base de conhecimento', text: 'Artigos em formato de feed que a equipe anexa na resposta e o cliente consulta no portal.' },
  { icon: 'forum', title: 'Fórum', text: 'Discussões da equipe com votos e respostas aninhadas, para resolver junto o que é novo.' },
  { icon: 'dashboard', title: 'Dashboards', text: 'Abertos por empresa, categorias, ranking de quem abre e de quem encerra, tendência mensal.' },
  { icon: 'bell', title: 'Notificações em tempo real', text: 'Som e alerta do navegador a cada chamado novo ou resposta do cliente.' },
  { icon: 'users', title: 'Portal do cliente', text: 'Cada empresa cadastra seus membros, abre chamados para os sistemas contratados e acompanha tudo.' },
] as const;

const SYSTEMS = SYSTEMS_LIST.filter((s) => s !== 'Outros').map((name) => ({ name, ...SYSTEM_INFO[name] }));

const STEPS = [
  { title: 'Abertura', text: 'O cliente abre o chamado no portal, escolhe o sistema e anexa prints ou áudios.' },
  { title: 'Triagem', text: 'O chamado entra na aba da empresa com prioridade e SLA, e a equipe é notificada.' },
  { title: 'Atendimento', text: 'Resposta, nota interna, ligação ou vídeo: tudo fica na mesma conversa.' },
  { title: 'Encerramento', text: 'Mensagem de encerramento enviada e transcrição completa arquivada no histórico.' },
] as const;

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Icon, Logo],
  template: `
    <div class="landing">
      <header class="ld-nav">
        <a routerLink="/" class="brand" aria-label="AIOA"><app-logo /><span class="wordmark">ΛIOΛ</span></a>
        <nav aria-label="Seções">
          <button (click)="go('funcionalidades')">Funcionalidades</button>
          <button (click)="go('sistemas')">Sistemas</button>
          <button (click)="go('como-funciona')">Como funciona</button>
        </nav>
        <div class="ld-nav-cta">
          <button class="ld-btn ghost" (click)="openDemo()">Agendar demo</button>
          <a class="ld-btn" routerLink="/login">Entrar <app-icon name="chevron-right" /></a>
        </div>
      </header>

      <section class="ld-hero">
        <span class="ld-pill"><span class="ld-dot"></span> Suporte do ecossistema Lex</span>
        <h1>Todo chamado,<br /><span>em um só lugar.</span></h1>
        <p>A AIOA conecta os clientes do LexFlow, LexÁgile, LexHub, LexPré e LexChat à equipe de suporte. Do primeiro print à transcrição final, nada se perde.</p>
        <div class="ld-cta">
          <button class="ld-btn accent" (click)="openDemo()">Agendar demo <app-icon name="chevron-right" /></button>
          <button class="ld-btn ghost" (click)="go('funcionalidades')">Ver funcionalidades</button>
        </div>
        <dl class="ld-stats">
          <div><dt>Chamados atendidos</dt><dd>{{ stats().total }}</dd></div>
          <div><dt>Taxa de resolução</dt><dd>{{ stats().rate ?? 0 }}%</dd></div>
          <div><dt>Empresas atendidas</dt><dd>{{ store.customers().length }}</dd></div>
          <div><dt>Sistemas cobertos</dt><dd>{{ systems.length }}</dd></div>
        </dl>
      </section>

      <!-- Product preview built from live data -->
      <section class="ld-window" aria-label="Prévia do sistema">
        <div class="ld-window-bar"><i></i><i></i><i></i><span>aioa / tickets</span></div>
        <ul>
          @for (t of preview(); track t.id) {
            <li>
              <b class="code">{{ code(t) }}</b>
              <span class="grow">{{ t.title }}<small>{{ t.company }} · {{ t.system }}</small></span>
              <span class="ld-status">{{ t.status }}</span>
            </li>
          }
        </ul>
      </section>

      <div class="ld-marquee" aria-hidden="true">
        <!-- Two identical groups, each at least as wide as the screen, so the loop never shows a gap. -->
        <div class="ld-track">
          @for (g of [1, 2]; track g) {
            <div class="ld-group">
              @for (r of [1, 2, 3]; track r) {
                @for (s of systems; track s.name) { <span>{{ s.name }}</span><i>✦</i> }
              }
            </div>
          }
        </div>
      </div>

      <section id="funcionalidades" class="ld-section">
        <span class="ld-eyebrow">Funcionalidades</span>
        <h2>Tudo que o suporte usa,<br /><span>sem trocar de tela.</span></h2>
        <div class="ld-grid">
          @for (f of features; track f.title) {
            <article class="ld-cell">
              <span class="ld-icon"><app-icon [name]="f.icon" /></span>
              <h3>{{ f.title }}</h3>
              <p>{{ f.text }}</p>
            </article>
          }
        </div>
      </section>

      <section id="sistemas" class="ld-section">
        <span class="ld-eyebrow">Sistemas</span>
        <h2>Cinco sistemas.<br /><span>Um só suporte.</span></h2>
        <p class="ld-lead">Cada empresa abre chamados para os sistemas que contratou — e para qualquer outro assunto em "Outros".</p>
        <div class="ld-systems">
          @for (s of systems; track s.name; let i = $index) {
            <article class="ld-system">
              <header><span class="ld-num">{{ (i + 1).toString().padStart(2, '0') }}</span><small>{{ s.tag }}</small></header>
              <h3>{{ s.name }}</h3>
              <p>{{ s.text }}</p>
              <ul>@for (it of s.items; track it) { <li><app-icon name="check" /> {{ it }}</li> }</ul>
            </article>
          }
        </div>
      </section>

      <section id="como-funciona" class="ld-section">
        <span class="ld-eyebrow">Como funciona</span>
        <h2>Do chamado aberto<br /><span>ao atendimento encerrado.</span></h2>
        <ol #timeline class="ld-steps" [class.in]="stepsIn()">
          @for (s of steps; track s.title; let i = $index) {
            <li [style.--i]="i"><span class="ld-num">{{ (i + 1).toString().padStart(2, '0') }}</span><h3>{{ s.title }}</h3><p>{{ s.text }}</p></li>
          }
        </ol>
      </section>

      <section class="ld-final">
        <h2>Quer ver a AIOA funcionando?</h2>
        <p>Agende uma demonstração com a nossa equipe. Já é cliente? Abra seu chamado pelo portal.</p>
        <div class="ld-cta">
          <button class="ld-btn accent" (click)="openDemo()">Agendar demo <app-icon name="chevron-right" /></button>
          <a class="ld-btn ghost" routerLink="/login">Entrar</a>
        </div>
      </section>

      <footer class="ld-foot">
        <span class="brand"><app-logo /><span class="wordmark">ΛIOΛ</span></span>
        <small>© {{ year }} Lex Group · Suporte para LexFlow, LexÁgile, LexHub, LexPré e LexChat</small>
      </footer>
    </div>

    <dialog #demoDlg class="demo-dlg" (click)="$event.target === demoDlg && demoDlg.close()" (close)="sent.set(false)">
      @if (sent()) {
        <div class="demo-done">
          <span class="ld-icon"><app-icon name="check" /></span>
          <h2>Pedido recebido!</h2>
          <p class="muted">Nossa equipe entra em contato pelo e-mail informado para combinar o melhor horário.</p>
          <button class="btn btn-primary" (click)="demoDlg.close()">Fechar</button>
        </div>
      } @else {
        <form (submit)="sendDemo($event)">
          <div class="dialog-head"><h2>Agendar demo</h2>
            <button type="button" class="icon-btn" aria-label="Fechar" (click)="demoDlg.close()"><app-icon name="x" /></button>
          </div>
          <div class="dialog-body form">
            <label class="field">Nome<input class="input" name="name" required placeholder="Seu nome" /></label>
            <label class="field">E-mail<input class="input" name="email" type="email" required placeholder="voce@empresa.com" /></label>
            <label class="field full">Empresa<input class="input" name="company" required placeholder="Nome do escritório ou empresa" /></label>
            <fieldset class="field full sys-pick">
              <legend>Sistemas de interesse</legend>
              @for (s of systems; track s.name) {
                <label class="check"><input type="checkbox" name="systems" [value]="s.name" /> {{ s.name }}</label>
              }
            </fieldset>
            <label class="field full">Mensagem<textarea class="input" name="message" rows="2" placeholder="Conte o que você quer ver (opcional)"></textarea></label>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn" (click)="demoDlg.close()">Cancelar</button>
            <button class="btn btn-primary">Solicitar demo</button>
          </div>
        </form>
      }
    </dialog>
  `,
})
export class Landing {
  protected readonly store = inject(Store);
  protected readonly code = code;
  protected readonly features = FEATURES;
  protected readonly systems = SYSTEMS;
  protected readonly steps = STEPS;
  protected readonly year = new Date().getFullYear();
  protected readonly stats = computed(() => kpiStats(this.store.tickets()));
  protected readonly preview = computed(() => this.store.tickets().filter((t) => !isClosed(t)).slice(0, 5));
  /** The timeline animates once, when it scrolls into view. */
  protected readonly stepsIn = signal(false);
  private readonly stepsEl = viewChild.required<ElementRef<HTMLElement>>('timeline');
  private readonly demoDlg = viewChild.required<ElementRef<HTMLDialogElement>>('demoDlg');
  protected readonly sent = signal(false);

  constructor() {
    afterNextRender(() => {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        this.stepsIn.set(true);
        io.disconnect();
      }, { threshold: 0.4 });
      io.observe(this.stepsEl().nativeElement);
    });
  }

  protected openDemo() {
    this.demoDlg().nativeElement.showModal();
  }

  protected sendDemo(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    this.store.requestDemo({ name: text('name'), email: text('email'), company: text('company'), systems: f.getAll('systems') as string[], message: text('message') });
    form.reset();
    this.sent.set(true);
  }

  protected go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
