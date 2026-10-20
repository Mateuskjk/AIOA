import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CATEGORIES, Category, Company, customerTabId, Priority, STATUSES, SYSTEMS, Status, Store, System, Ticket, ago, badge, code, initials, isClosed, sla } from '../data';
import { Icon } from '../ui';
import { Select, toOptions } from '../select';

/** A tab on the Tickets page: a saved slice of tickets (by company, system and/or category). */
interface TicketTab {
  id: string;
  label: string;
  company?: Company;
  system?: System;
  category?: Category;
  custom?: boolean;
}

const ALL_TAB: TicketTab = { id: 'all', label: 'TODOS' };
const TABS_KEY = 'aioa:ticket-tabs';
const ACTIVE_KEY = 'aioa:ticket-tab';
const VIEW_KEY = 'aioa:ticket-view';
/** Finished columns can hold hundreds of tickets; the board shows the most recent ones. */
const CLOSED_CARD_LIMIT = 20;

// Per-viewer UI preferences: fine to lose, so storage failures fall back silently.
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

@Component({
  selector: 'app-tickets',
  imports: [Icon, Select],
  template: `
    <div class="page wide dark-ui" [class.board-page]="view() === 'kanban'">
      <div class="page-head">
        <div>
          <span class="eyebrow">Atendimento</span>
          <h1>Tickets</h1>
          <p>{{ view() === 'list' ? filtered().length : base().length }} de {{ store.tickets().length }} chamados</p>
        </div>
        <div class="tt-bar">
          <nav class="tt-tabs" role="tablist" aria-label="Abas de tickets">
            @for (t of tabs(); track t.id) {
              <span class="tt-tab" [class.active]="activeTab().id === t.id">
                <button role="tab" [attr.aria-selected]="activeTab().id === t.id" (click)="selectTab(t.id)">
                  {{ t.label }} <em>{{ count(t) }}</em>
                </button>
                @if (t.custom) {
                  <button class="tt-x" [attr.aria-label]="'Remover aba ' + t.label" title="Remover aba" (click)="removeTab(t.id)"><app-icon name="x" /></button>
                }
              </span>
            }
          </nav>
          <div class="seg view-toggle" role="radiogroup" aria-label="Visualização">
            <button type="button" role="radio" [attr.aria-checked]="view() === 'list'" [class.on]="view() === 'list'" (click)="setView('list')"><app-icon name="list" /> Lista</button>
            <button type="button" role="radio" [attr.aria-checked]="view() === 'kanban'" [class.on]="view() === 'kanban'" (click)="setView('kanban')"><app-icon name="kanban" /> Kanban</button>
          </div>
          <button class="btn tt-add" (click)="tabDialog().nativeElement.showModal()"><app-icon name="plus" /> Nova aba</button>
        </div>
      </div>

      <div class="toolbar">
        <input #q class="input grow" placeholder="Buscar por código, título ou descrição…" (input)="query.set(q.value)" />
        @if (view() === 'list') {
          <app-select class="tb-select" label="Status" [options]="statusOptions" [(value)]="status" />
        }
        <app-select class="tb-select" label="Sistema" [options]="systemFilterOptions" [(value)]="system" />
        <button class="btn" [class.on]="mine()" (click)="mine.set(!mine())">Meus chamados</button>
      </div>

      @if (view() === 'list') {
      <div class="card">
        <ul class="list tickets">
          @for (t of filtered(); track t.id) {
            <li class="clickable" (click)="open(t.id)">
              <i class="dot" [class]="badge(t.priority)" [title]="'Prioridade ' + t.priority"></i>
              <div class="grow">
                <div class="t-head"><b class="code">{{ code(t) }}</b><strong>{{ t.title }}</strong></div>
                <p class="t-desc">{{ t.description }}</p>
                <small class="muted">{{ t.company }} · {{ t.system }} · {{ t.category }} › {{ t.subcategory }} · {{ t.requester }} · atualizado {{ ago(t.updatedAt) }}</small>
              </div>
              <div class="t-side">
                <span [class]="badge(t.status)">{{ t.status }}</span>
                <small [class.sla-late]="sla(t).late" class="muted"><app-icon name="clock" /> {{ sla(t).label }}</small>
                <small class="muted">{{ t.assignee ?? 'Sem responsável' }}</small>
              </div>
            </li>
          } @empty {
            <li class="empty">Nenhum chamado com esses filtros.</li>
          }
        </ul>
      </div>
      } @else {
        <div class="board" aria-label="Quadro kanban por status">
          @for (col of board(); track col.status) {
            <section class="board-col" [class.drop]="dropTarget() === col.status" [attr.aria-label]="col.status"
              (dragover)="dragOver($event, col.status)" (dragleave)="dropTarget.set(null)" (drop)="drop($event, col.status)">
              <header class="board-head"><span [class]="badge(col.status)">{{ col.status }}</span><em>{{ col.total }}</em></header>
              <div class="board-cards">
                @for (t of col.cards; track t.id) {
                  <article class="board-card" draggable="true" tabindex="0" [class.dragging]="dragId() === t.id"
                    (dragstart)="drag($event, t.id)" (dragend)="dragId.set(null)" (click)="open(t.id)" (keydown.enter)="open(t.id)">
                    <div class="bc-top"><b class="code">{{ code(t) }}</b><i class="dot" [class]="badge(t.priority)" [title]="'Prioridade ' + t.priority"></i></div>
                    <strong class="bc-title">{{ t.title }}</strong>
                    <small class="muted">{{ short(t.company) }} · {{ t.system }} · {{ t.category }}</small>
                    <div class="bc-foot">
                      <small class="muted" [class.sla-late]="sla(t).late"><app-icon name="clock" /> {{ sla(t).label }}</small>
                      <span class="avatar xs" [title]="t.assignee ?? 'Sem responsável'">{{ t.assignee ? initials(t.assignee) : '—' }}</span>
                    </div>
                  </article>
                } @empty {
                  <p class="board-empty">Solte um chamado aqui</p>
                }
                @if (col.total > col.cards.length) {
                  <button class="board-more" (click)="showInList(col.status)">+{{ col.total - col.cards.length }} chamados — ver na lista</button>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>

    <dialog #tabDlg>
      <form method="dialog" (submit)="addTab($event)">
        <div class="dialog-head"><h2>Nova aba</h2>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="tabDlg.close()"><app-icon name="x" /></button>
        </div>
        <div class="dialog-body form">
          <label class="field full">Nome da aba<input class="input" name="label" required maxlength="24" placeholder="Ex.: Bugs do LexHub" /></label>
          <label class="field full">Empresa
            <app-select name="company" label="Empresa" [options]="companyOptions()" value="" />
          </label>
          <label class="field">Sistema
            <app-select name="system" label="Sistema" [options]="tabSystemOptions" value="" />
          </label>
          <label class="field">Categoria
            <app-select name="category" label="Categoria" [options]="tabCategoryOptions" value="" />
          </label>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="tabDlg.close()">Cancelar</button>
          <button class="btn btn-primary">Criar aba</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Tickets {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly statuses = STATUSES;
  protected readonly systems = SYSTEMS;
  protected readonly categories = Object.keys(CATEGORIES) as Category[];
  protected readonly statusOptions = [{ value: '', label: 'Abertos (todos ativos)' }, { value: '*', label: 'Todos os status' }, ...toOptions(STATUSES)];
  protected readonly systemFilterOptions = [{ value: '', label: 'Todos os sistemas' }, ...toOptions(SYSTEMS)];
  protected readonly tabSystemOptions = [{ value: '', label: 'Todos' }, ...toOptions(SYSTEMS)];
  protected readonly tabCategoryOptions = [{ value: '', label: 'Todas' }, ...toOptions(this.categories)];
  protected readonly companyOptions = computed(() => [{ value: '', label: 'Todas' }, ...this.store.customers().map((c) => ({ value: c.name, label: c.name, hint: c.short }))]);

  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly sla = sla;
  protected readonly initials = initials;

  protected readonly query = signal('');
  protected readonly status = signal('');
  protected readonly system = signal('');
  protected readonly mine = signal(false);

  private readonly rank: Record<Priority, number> = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
  /** Tab, system, "Meus chamados" and search — shared by the list and the board. */
  protected readonly base = computed(() => {
    const q = this.query().trim().toLowerCase();
    const me = this.store.user().name;
    const tab = this.activeTab();
    return this.store
      .tickets()
      .filter(
        (t) =>
          this.inTab(t, tab) &&
          (!this.system() || t.system === this.system()) &&
          (!this.mine() || t.assignee === me) &&
          (!q || `${code(t)} ${t.title} ${t.description}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => this.rank[a.priority] - this.rank[b.priority] || b.updatedAt - a.updatedAt);
  });

  protected readonly filtered = computed(() => {
    const st = this.status();
    return this.base().filter((t) => st === '*' || (st ? t.status === st : !isClosed(t)));
  });

  // ---- kanban ----
  protected readonly view = signal<'list' | 'kanban'>(load(VIEW_KEY, 'list'));
  protected readonly dragId = signal<number | null>(null);
  protected readonly dropTarget = signal<Status | null>(null);

  protected readonly board = computed(() =>
    STATUSES.map((status) => {
      const all = this.base().filter((t) => t.status === status);
      const finished = isClosed({ status } as Ticket);
      const cards = finished ? [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, CLOSED_CARD_LIMIT) : all;
      return { status, total: all.length, cards };
    }),
  );

  protected setView(v: 'list' | 'kanban') {
    this.view.set(v);
    save(VIEW_KEY, v);
  }

  protected short(c: Company) {
    return this.store.customers().find((x) => x.name === c)?.short ?? c;
  }

  protected showInList(status: Status) {
    this.status.set(status);
    this.setView('list');
  }

  protected drag(e: DragEvent, id: number) {
    e.dataTransfer?.setData('text/plain', String(id));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.dragId.set(id);
  }

  protected dragOver(e: DragEvent, status: Status) {
    e.preventDefault();
    this.dropTarget.set(status);
  }

  /** Moving a card changes its status; "Resolvido" runs the full resolve flow (closing message + transcript). */
  protected drop(e: DragEvent, status: Status) {
    e.preventDefault();
    this.dropTarget.set(null);
    this.dragId.set(null);
    const id = Number(e.dataTransfer?.getData('text/plain'));
    const t = this.store.ticket(id);
    if (!t || t.status === status) return;
    if (status === 'Resolvido') this.store.resolve(id);
    else this.store.updateTicket(id, { status });
  }

  // ---- tabs ----
  protected readonly tabDialog = viewChild.required<ElementRef<HTMLDialogElement>>('tabDlg');
  /** User-made tabs (saved in this browser). */
  private readonly customTabs = signal<TicketTab[]>(load<TicketTab[]>(TABS_KEY, []));
  /** TODOS, one tab per customer (so a new customer gets its tab automatically), then the user's own tabs. */
  protected readonly tabs = computed<TicketTab[]>(() => [
    ALL_TAB,
    ...this.store.customers().map((c) => ({ id: customerTabId(c.short), label: c.short, company: c.name })),
    ...this.customTabs(),
  ]);
  private readonly activeId = signal(load<string>(ACTIVE_KEY, 'all'));
  protected readonly activeTab = computed(() => this.tabs().find((t) => t.id === this.activeId()) ?? this.tabs()[0]);

  protected inTab(t: Ticket, tab: TicketTab) {
    return (!tab.company || t.company === tab.company) && (!tab.system || t.system === tab.system) && (!tab.category || t.category === tab.category);
  }

  /** Active (not finished) tickets in a tab — the number shown on it. */
  protected count(tab: TicketTab) {
    return this.store.tickets().filter((t) => !isClosed(t) && this.inTab(t, tab)).length;
  }

  protected selectTab(id: string) {
    this.activeId.set(id);
    save(ACTIVE_KEY, id);
  }

  protected addTab(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const tab: TicketTab = {
      id: `tab-${Date.now()}`,
      label: f['label'].trim().toUpperCase(),
      company: (f['company'] || undefined) as Company | undefined,
      system: (f['system'] || undefined) as System | undefined,
      category: (f['category'] || undefined) as Category | undefined,
      custom: true,
    };
    this.customTabs.update((ts) => [...ts, tab]);
    this.saveTabs();
    this.selectTab(tab.id);
    form.reset();
  }

  protected removeTab(id: string) {
    this.customTabs.update((ts) => ts.filter((t) => t.id !== id));
    this.saveTabs();
    if (this.activeId() === id) this.selectTab('all');
  }

  private saveTabs() {
    save(TABS_KEY, this.customTabs());
  }

  open(id: number) {
    this.router.navigate(['/tickets', id]);
  }
}
