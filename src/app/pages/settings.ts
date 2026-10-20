import { Component, computed, inject, signal } from '@angular/core';
import { DEFAULT_PREFS, Prefs, Store, initials } from '../data';
import { Notifier } from '../notifier';
import { Icon } from '../ui';

const VIEW_KEY = 'aioa:ticket-view'; // same key Tickets reads

const SECTIONS = [
  { id: 'profile', label: 'Perfil', icon: 'users', hint: 'Nome e cargo exibidos nas conversas' },
  { id: 'notifications', label: 'Notificações', icon: 'bell', hint: 'Som e alertas do navegador' },
  { id: 'service', label: 'Atendimento', icon: 'headset', hint: 'Encerramento e transcrição' },
  { id: 'tickets', label: 'Tickets', icon: 'ticket', hint: 'Visualização padrão' },
  { id: 'widget', label: 'Widget (embed)', icon: 'monitor-up', hint: 'Código para instalar o assistente' },
] as const;

@Component({
  selector: 'app-settings',
  imports: [Icon],
  template: `
    <div class="page wide dark-ui set-page">
      <div class="page-head"><div><span class="eyebrow">Conta</span><h1>Configurações</h1>
        <p>Preferências da sua conta e do atendimento. Tudo é salvo automaticamente.</p></div></div>

      <div class="set-grid">
        <nav class="card set-nav" aria-label="Seções">
          @for (s of sections; track s.id) {
            <button [class.on]="section() === s.id" [attr.aria-current]="section() === s.id" (click)="section.set(s.id)">
              <app-icon [name]="s.icon" />
              <span><strong>{{ s.label }}</strong><small>{{ s.hint }}</small></span>
            </button>
          }
        </nav>

        <section class="card set-body">
          @switch (section()) {
            @case ('profile') {
              <h2>Perfil</h2>
              <div class="set-profile">
                <span class="avatar lg">{{ initials(store.user().name) }}</span>
                <div><strong>{{ store.user().name }}</strong><small class="muted">{{ store.user().role }}</small></div>
              </div>
              <form class="set-form" (submit)="saveProfile($event)">
                <label class="field">Nome<input class="input" name="name" [value]="store.user().name" required /></label>
                <label class="field">Cargo<input class="input" name="role" [value]="store.user().role" /></label>
                <div class="set-actions">
                  <button class="btn btn-accent"><app-icon name="check" /> Salvar perfil</button>
                  @if (saved()) { <span class="muted" role="status">Salvo!</span> }
                </div>
              </form>
            }
            @case ('notifications') {
              <h2>Notificações</h2>
              <label class="set-row">
                <span><strong>Som de notificação</strong><small class="muted">Toca um aviso sonoro a cada nova notificação do sistema.</small></span>
                <input type="checkbox" class="switch" [checked]="prefs().sound" (change)="set({ sound: $any($event.target).checked })" />
              </label>
              <label class="set-row">
                <span><strong>Notificações do navegador</strong><small class="muted">Mostra um alerta do sistema operacional, mesmo com a aba em segundo plano.</small></span>
                <input type="checkbox" class="switch" [checked]="prefs().push" (change)="set({ push: $any($event.target).checked })" />
              </label>
              <div class="set-row">
                <span><strong>Permissão do navegador</strong><small class="muted">{{ permissionLabel() }}</small></span>
                @if (notifier.permission() === 'default') {
                  <button class="btn" (click)="notifier.enable()"><app-icon name="bell" /> Permitir</button>
                }
              </div>
              <div class="set-actions">
                <button class="btn" (click)="test()"><app-icon name="bell" /> Testar notificação</button>
              </div>
            }
            @case ('service') {
              <h2>Atendimento</h2>
              <label class="field">Mensagem de encerramento
                <textarea class="input" rows="3" [value]="prefs().closing" (change)="set({ closing: $any($event.target).value.trim() || defaults.closing })"></textarea>
                <small class="muted">Enviada ao cliente ao marcar o chamado como resolvido. Use <code>{{ '{cliente}' }}</code> e <code>{{ '{codigo}' }}</code>.</small>
              </label>
              <p class="set-preview"><small class="muted">Prévia</small>{{ preview() }}</p>
              <label class="set-row">
                <span><strong>Anexar transcrição como nota interna</strong><small class="muted">Além do Histórico de tickets, adiciona o .txt da conversa no próprio chamado.</small></span>
                <input type="checkbox" class="switch" [checked]="prefs().transcriptNote" (change)="set({ transcriptNote: $any($event.target).checked })" />
              </label>
              <div class="set-actions">
                <button class="btn" (click)="set({ closing: defaults.closing, transcriptNote: defaults.transcriptNote })">Restaurar padrão</button>
              </div>
            }
            @case ('tickets') {
              <h2>Tickets</h2>
              <div class="set-row">
                <span><strong>Visualização padrão</strong><small class="muted">Como a tela de tickets abre.</small></span>
                <div class="seg view-toggle" role="radiogroup" aria-label="Visualização padrão">
                  <button type="button" role="radio" [attr.aria-checked]="view() === 'list'" [class.on]="view() === 'list'" (click)="setView('list')"><app-icon name="list" /> Lista</button>
                  <button type="button" role="radio" [attr.aria-checked]="view() === 'kanban'" [class.on]="view() === 'kanban'" (click)="setView('kanban')"><app-icon name="kanban" /> Kanban</button>
                </div>
              </div>
            }
            @case ('widget') {
              <h2>Widget (embed)</h2>
              <p class="muted set-lead">Gere o código para instalar o Assistente AIOA em outro sistema (LexFlow, LexHub…). Cole antes de <code>&lt;/body&gt;</code> nas páginas onde o botão de suporte deve aparecer.</p>
              <div class="set-form">
                <label class="field full">Endereço do AIOA<input #o class="input" [value]="embedOrigin()" (input)="embedOrigin.set(o.value.trim())" placeholder="https://suporte.lexgroup.com.br" /></label>
              </div>
              <div class="embed-code">
                <pre><code>{{ embedSnippet() }}</code></pre>
                <div class="set-actions">
                  <button class="btn btn-accent" (click)="copyEmbed()"><app-icon name="check" /> {{ copied() ? 'Copiado!' : 'Copiar código' }}</button>
                  <a class="btn" href="/lexflow-demo.html" target="_blank" rel="noopener"><app-icon name="eye" /> Ver demonstração</a>
                </div>
              </div>
            }
          }
        </section>
      </div>
    </div>
  `,
})
export class Settings {
  protected readonly store = inject(Store);
  protected readonly notifier = inject(Notifier);
  protected readonly sections = SECTIONS;
  protected readonly defaults = DEFAULT_PREFS;
  protected readonly initials = initials;
  protected readonly section = signal<(typeof SECTIONS)[number]['id']>('profile');
  protected readonly saved = signal(false);
  protected readonly prefs = this.store.prefs;
  protected readonly view = signal<'list' | 'kanban'>(readView());

  // Widget (embed) code generator
  protected readonly embedOrigin = signal(typeof location !== 'undefined' ? location.origin : '');
  protected readonly copied = signal(false);
  protected readonly embedSnippet = computed(() => `<script src="${this.embedOrigin().replace(/\/+$/, '')}/widget.js" defer></script>`);

  protected async copyEmbed() {
    await navigator.clipboard?.writeText(this.embedSnippet());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected preview() {
    return this.prefs().closing.replaceAll('{cliente}', 'Carla').replaceAll('{codigo}', 'A-142');
  }

  protected permissionLabel() {
    return {
      granted: 'Permitido — os alertas aparecem no sistema.',
      denied: 'Bloqueado. Libere nas configurações do site no navegador.',
      default: 'Ainda não solicitada.',
      unsupported: 'Este navegador não suporta notificações.',
    }[this.notifier.permission()];
  }

  protected set(patch: Partial<Prefs>) {
    this.store.setPrefs(patch);
  }

  protected saveProfile(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    this.store.setUser({ name: String(f.get('name')).trim(), role: String(f.get('role')).trim() });
    this.saved.set(true);
  }

  protected test() {
    if (this.prefs().sound) this.notifier.chime();
    if (this.prefs().push) this.notifier.push('Notificação de teste do AIOA.');
  }

  protected setView(v: 'list' | 'kanban') {
    this.view.set(v);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(v));
    } catch {}
  }
}

function readView(): 'list' | 'kanban' {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) ?? '"list"') === 'kanban' ? 'kanban' : 'list';
  } catch {
    return 'list';
  }
}
