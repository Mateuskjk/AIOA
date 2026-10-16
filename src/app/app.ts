import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store, badge, code, initials } from './data';
import { Icon, Logo } from './ui';

const COLLAPSE_KEY = 'aioa:sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  host: { '(document:keydown.control.k)': 'openSearch($event)', '(document:keydown.meta.k)': 'openSearch($event)' },
  template: `
    @if (portal()) {
      <router-outlet />
    } @else {
    <div class="shell" [class.collapsed]="collapsed()">
      <aside class="sidebar">
        <div class="sb-top">
          <a routerLink="/dashboard" class="brand" aria-label="AIOA">
            <app-logo /><span class="wordmark">ΛIOΛ</span>
          </a>
          <button class="icon-btn sb-toggle" (click)="toggle()" [attr.aria-label]="collapsed() ? 'Expandir menu' : 'Recolher menu'">
            <app-icon name="panel" />
          </button>
        </div>

        <button class="sb-item sb-search" (click)="openSearch()" title="Pesquisar">
          <app-icon name="search" /><span>Pesquisar</span><kbd>Ctrl K</kbd>
        </button>

        <nav>
          @for (item of nav; track item.path) {
            <a class="sb-item" [routerLink]="item.path" routerLinkActive="active" [title]="item.label">
              <app-icon [name]="item.icon" /><span>{{ item.label }}</span>
              @if (counts()[item.path]; as n) {
                <em class="count">{{ n }}</em>
              }
            </a>
          }
        </nav>

        <div class="sb-section"><app-icon name="pin" /><span>Fixados</span></div>
        <div class="sb-pins">
          @for (t of store.pinned(); track t.id) {
            <a class="sb-item pin" [routerLink]="['/tickets', t.id]" routerLinkActive="active" [title]="code(t) + ' ' + t.title">
              <i class="dot" [class]="badge(t.priority)"></i><span>{{ code(t) }} {{ t.title }}</span>
            </a>
          } @empty {
            <p class="sb-empty">Fixe chamados para acesso rápido.</p>
          }
        </div>

        <div class="sb-user">
          <div class="avatar">{{ initials() }}</div>
          <div class="who"><strong>{{ store.user().name }}</strong><small>{{ store.user().role }}</small></div>
          <a class="icon-btn" routerLink="/settings" aria-label="Configurações" title="Configurações"><app-icon name="settings" /></a>
        </div>
      </aside>

      <main class="main"><router-outlet /></main>
    </div>

    <dialog #search class="palette" (close)="query.set('')">
      <div class="palette-input">
        <app-icon name="search" />
        <input #q placeholder="Buscar chamados por número, título, empresa ou sistema…" [value]="query()"
          (input)="query.set(q.value)" (keydown.enter)="go(results()[0]?.id)" />
      </div>
      <ul>
        @for (t of results(); track t.id) {
          <li><button (click)="go(t.id)"><b>{{ code(t) }}</b> {{ t.title }}<small>{{ t.company }} · {{ t.system }}</small></button></li>
        } @empty {
          <li class="muted pad">Nenhum chamado encontrado.</li>
        }
      </ul>
    </dialog>
    }
  `,
})
export class App {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/inbox', label: 'Inbox', icon: 'inbox' },
    { path: '/notifications', label: 'Notificações', icon: 'bell' },
    { path: '/tickets', label: 'Tickets', icon: 'ticket' },
    { path: '/ticket-history', label: 'Histórico de tickets', icon: 'archive' },
    { path: '/forum', label: 'Fórum', icon: 'forum' },
    { path: '/report', label: 'Report', icon: 'report' },
    { path: '/kb', label: 'Base de conhecimento', icon: 'book' },
    { path: '/customers', label: 'Clientes', icon: 'users' },
  ];

  protected readonly counts = computed<Record<string, number>>(() => ({
    '/inbox': this.store.unreadDms(),
    '/notifications': this.store.unread(),
  }));

  protected readonly collapsed = signal(typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1');
  protected readonly initials = computed(() => initials(this.store.user().name));

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('search');

  /** The customer portal has its own layout, without the team's sidebar. */
  protected readonly portal = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.startsWith('/portal')),
    ),
    { initialValue: typeof location !== 'undefined' && location.pathname.startsWith('/portal') },
  );
  protected readonly query = signal('');
  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase().trim();
    const all = this.store.tickets();
    if (!q) return all.slice(0, 8);
    return all
      .filter((t) => `${code(t)} ${t.title} ${t.company} ${t.system} ${t.requester}`.toLowerCase().includes(q))
      .slice(0, 8);
  });

  toggle() {
    this.collapsed.update((c) => !c);
    localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
  }

  openSearch(e?: Event) {
    e?.preventDefault();
    this.dialog()?.nativeElement.showModal();
  }

  go(id?: number) {
    if (id == null) return;
    this.dialog()?.nativeElement.close();
    this.router.navigate(['/tickets', id]);
  }
}
