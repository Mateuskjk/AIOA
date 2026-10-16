import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AGENTS, PRIORITIES, STATUSES, Store, Ticket, ago, badge, code, fmt, isClosed, sla } from '../data';
import { Attachments } from '../composer';
import { Icon } from '../ui';

type Panel = 'detalhes' | 'atividade' | 'kb' | 'forum' | 'report' | 'conversas';
const PANEL_KEY = 'aioa:ticket-panel';

/** Right-hand rail of the ticket screen: quick-access panels that can drop content into the reply. */
@Component({
  selector: 'app-ticket-side',
  imports: [Icon, RouterLink, Attachments],
  host: { class: 'td-side', '[class.collapsed]': '!panel()' },
  template: `
    @if (panel(); as p) {
      <section class="side-panel" [attr.aria-label]="label(p)">
        <header class="side-head">
          <h2>{{ label(p) }}</h2>
          <button class="icon-btn" aria-label="Recolher painel" title="Recolher" (click)="toggle(p)"><app-icon name="chevron-right" /></button>
        </header>

        @switch (p) {
          @case ('detalhes') {
            <label class="field">Status
              <select class="input" #s (change)="store.updateTicket(t().id, { status: $any(s.value) })">
                @for (x of statuses; track x) { <option [selected]="x === t().status">{{ x }}</option> }
              </select>
            </label>
            <label class="field">Prioridade
              <select class="input" #pr (change)="store.updateTicket(t().id, { priority: $any(pr.value) })">
                @for (x of priorities; track x) { <option [selected]="x === t().priority">{{ x }}</option> }
              </select>
            </label>
            <label class="field">Responsável
              <select class="input" #a (change)="store.updateTicket(t().id, { assignee: a.value || null })">
                <option value="">Sem responsável</option>
                @for (x of agents; track x) { <option [selected]="x === t().assignee">{{ x }}</option> }
              </select>
            </label>
            <dl>
              <dt>Código</dt><dd>{{ code(t()) }}</dd>
              <dt>Empresa</dt><dd>{{ t().company }}</dd>
              <dt>Sistema</dt><dd>{{ t().system }}</dd>
              <dt>Solicitante</dt><dd>{{ t().requester }}</dd>
              <dt>Aberto em</dt><dd>{{ fmt(t().createdAt) }}</dd>
              <dt>Atualizado</dt><dd>{{ ago(t().updatedAt) }}</dd>
              <dt>SLA</dt><dd [class.sla-late]="sla(t()).late">{{ sla(t()).label }}</dd>
              <dt>Mensagens</dt><dd>{{ t().messages.length }}</dd>
              <dt>Tarefas</dt><dd>{{ t().tasks.length - openTasks() }} de {{ t().tasks.length }}</dd>
            </dl>
            <div class="side-desc">
              <span class="eyebrow">Descrição</span>
              <p class="desc">{{ t().description }}</p>
              @if (t().messages[0]?.files?.length) { <app-attachments [files]="t().messages[0].files!" /> }
              <button class="btn btn-sm" (click)="insert.emit('> ' + t().description)"><app-icon name="plus" /> Citar na resposta</button>
            </div>
          }

          @case ('atividade') {
            <div class="seg seg-full" role="tablist" aria-label="Atividade">
              <button type="button" role="tab" [attr.aria-selected]="activity() === 'tarefas'" [class.on]="activity() === 'tarefas'" (click)="activity.set('tarefas')">
                Tarefas @if (openTasks()) { <em class="count">{{ openTasks() }}</em> }
              </button>
              <button type="button" role="tab" [attr.aria-selected]="activity() === 'historico'" [class.on]="activity() === 'historico'" (click)="activity.set('historico')">Histórico</button>
            </div>
            @if (activity() === 'tarefas') {
              <ul class="tasks">
                @for (task of t().tasks; track $index) {
                  <li><label class="check"><input type="checkbox" [checked]="task.done" (change)="toggleTask($index)" />
                    <span [class.done]="task.done">{{ task.text }}</span></label></li>
                } @empty {
                  <li class="muted">Nenhuma tarefa ainda.</li>
                }
              </ul>
              <form class="toolbar" (submit)="addTask($event)">
                <input class="input grow" name="task" placeholder="Nova tarefa…" required aria-label="Nova tarefa" />
                <button class="btn btn-sm" aria-label="Adicionar tarefa"><app-icon name="plus" /></button>
              </form>
            } @else {
              <ol class="timeline">
                @for (l of t().log.slice().reverse(); track $index) {
                  <li class="event"><span class="ev-icon"><app-icon name="clock" /></span>
                    <span>{{ l.text }}<br /><small class="muted">{{ fmt(l.at) }}</small></span></li>
                }
              </ol>
            }
          }

          @case ('kb') {
            <input #kq class="input" placeholder="Buscar artigos…" aria-label="Buscar artigos" (input)="query.set(kq.value)" />
            <ul class="side-list">
              @for (a of articles(); track a.id) {
                <li>
                  <div class="side-item-head"><span class="badge">{{ a.system }}</span><small class="muted">{{ a.views }} views</small></div>
                  <a [routerLink]="['/kb', a.id]" target="_blank"><strong>{{ a.title }}</strong></a>
                  <p class="muted">{{ a.summary }}</p>
                  <button class="btn btn-sm" (click)="insert.emit('📘 ' + a.title + '\\n' + a.summary + '\\n' + link('/kb/' + a.id))">
                    <app-icon name="plus" /> Inserir na conversa
                  </button>
                </li>
              } @empty {
                <li class="muted">Nenhum artigo encontrado.</li>
              }
            </ul>
          }

          @case ('forum') {
            <input #fq class="input" placeholder="Buscar no fórum…" aria-label="Buscar no fórum" (input)="query.set(fq.value)" />
            <ul class="side-list">
              @for (f of topics(); track f.id) {
                <li>
                  <div class="side-item-head"><span class="badge">{{ f.system }}</span><small class="muted">{{ f.replies.length }} respostas</small></div>
                  <strong>{{ f.title }}</strong>
                  @if (f.replies.at(-1); as r) { <p class="muted">“{{ r.body }}” — {{ r.author }}</p> }
                  <button class="btn btn-sm" (click)="insert.emit('💬 Tópico do fórum: ' + f.title + '\\n' + link('/forum'))">
                    <app-icon name="plus" /> Inserir na conversa
                  </button>
                </li>
              } @empty {
                <li class="muted">Nenhum tópico encontrado.</li>
              }
            </ul>
          }

          @case ('report') {
            <span class="eyebrow">{{ t().company }}</span>
            <div class="side-stats">
              <div><b>{{ report().total }}</b><small>Chamados</small></div>
              <div><b>{{ report().open }}</b><small>Ativos</small></div>
              <div><b>{{ report().avg ?? '—' }}</b><small>Tempo médio (h)</small></div>
              <div><b>{{ report().sla == null ? '—' : report().sla + '%' }}</b><small>SLA cumprido</small></div>
            </div>
            <span class="eyebrow">Por sistema</span>
            <div class="bars">
              @for (r of report().bySystem; track r.label) {
                <div class="bar-row side-bar"><span>{{ r.label }}</span><div class="bar accent"><i [style.width.%]="r.pct"></i></div><b>{{ r.n }}</b></div>
              }
            </div>
            <button class="btn" (click)="insert.emit(reportText())"><app-icon name="plus" /> Inserir resumo na conversa</button>
            <a class="muted" routerLink="/report">Abrir relatório completo</a>
          }

          @case ('conversas') {
            <span class="eyebrow">Outros chamados de {{ t().company }}</span>
            <ul class="side-list">
              @for (o of related(); track o.id) {
                <li>
                  <div class="side-item-head"><b class="code">{{ code(o) }}</b><span [class]="badge(o.status)">{{ o.status }}</span></div>
                  <a [routerLink]="['/tickets', o.id]"><strong>{{ o.title }}</strong></a>
                  @if (o.messages.at(-1); as m) { <p class="muted">{{ m.author }}: {{ m.body || '📎 Anexo' }}</p> }
                  <button class="btn btn-sm" (click)="insert.emit('🔗 Relacionado ao chamado ' + code(o) + ' — ' + o.title)">
                    <app-icon name="plus" /> Referenciar na conversa
                  </button>
                </li>
              } @empty {
                <li class="muted">Nenhum outro chamado deste cliente.</li>
              }
            </ul>
          }
        }
      </section>
    }

    <nav class="side-rail" aria-label="Painéis do chamado">
      @for (x of rail; track x.key) {
        <button class="rail-btn" [class.active]="panel() === x.key" [attr.aria-pressed]="panel() === x.key"
          [attr.aria-label]="x.label" [title]="x.label" (click)="toggle(x.key)">
          <app-icon [name]="x.icon" />
          @if (x.key === 'atividade' && openTasks()) { <em class="rail-count">{{ openTasks() }}</em> }
        </button>
      }
    </nav>
  `,
})
export class TicketSide {
  readonly t = input.required<Ticket>();
  /** Text to drop into the reply box. */
  readonly insert = output<string>();

  protected readonly store = inject(Store);
  protected readonly statuses = STATUSES;
  protected readonly priorities = PRIORITIES;
  protected readonly agents = AGENTS;
  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly fmt = fmt;
  protected readonly sla = sla;

  protected readonly rail: { key: Panel; label: string; icon: string }[] = [
    { key: 'detalhes', label: 'Detalhes do chamado', icon: 'info' },
    { key: 'atividade', label: 'Atividade: tarefas e histórico', icon: 'list-checks' },
    { key: 'kb', label: 'Base de conhecimento', icon: 'book' },
    { key: 'forum', label: 'Fórum', icon: 'forum' },
    { key: 'report', label: 'Report do cliente', icon: 'report' },
    { key: 'conversas', label: 'Conversas do cliente', icon: 'history' },
  ];
  protected label(p: Panel) {
    return this.rail.find((x) => x.key === p)!.label;
  }

  protected readonly panel = signal<Panel | null>(this.saved());
  protected readonly query = signal('');

  private saved(): Panel | null {
    try {
      const v = localStorage.getItem(PANEL_KEY);
      if (v === 'none') return null;
      return this.rail.some((x) => x.key === v) ? (v as Panel) : 'detalhes';
    } catch {
      return 'detalhes';
    }
  }

  protected toggle(p: Panel) {
    const next = this.panel() === p ? null : p;
    this.panel.set(next);
    this.query.set('');
    try {
      localStorage.setItem(PANEL_KEY, next ?? 'none');
    } catch {}
  }

  protected link(path: string) {
    return location.origin + path;
  }

  protected readonly activity = signal<'tarefas' | 'historico'>('tarefas');
  protected readonly openTasks = computed(() => this.t().tasks.filter((x) => !x.done).length);

  protected toggleTask(i: number) {
    const t = this.t();
    this.store.updateTicket(t.id, { tasks: t.tasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) });
  }

  protected addTask(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const text = String(new FormData(form).get('task') ?? '').trim();
    if (text) this.store.updateTicket(this.t().id, { tasks: [...this.t().tasks, { text, done: false }] });
    form.reset();
  }

  private matches(text: string) {
    const q = this.query().trim().toLowerCase();
    return !q || text.toLowerCase().includes(q);
  }

  /** Same-system content first: it's the most likely to answer this ticket. */
  protected readonly articles = computed(() =>
    this.store
      .articles()
      .filter((a) => this.matches(`${a.title} ${a.summary} ${a.body}`))
      .sort((a, b) => Number(b.system === this.t().system) - Number(a.system === this.t().system) || b.views - a.views),
  );
  protected readonly topics = computed(() =>
    this.store
      .topics()
      .filter((f) => this.matches(`${f.title} ${f.replies.map((r) => r.body).join(' ')}`))
      .sort((a, b) => Number(b.system === this.t().system) - Number(a.system === this.t().system) || b.at - a.at),
  );
  protected readonly related = computed(() =>
    this.store
      .tickets()
      .filter((o) => o.company === this.t().company && o.id !== this.t().id)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );

  protected readonly report = computed(() => {
    const ts = this.store.tickets().filter((o) => o.company === this.t().company);
    const done = ts.filter(isClosed);
    const hrs = done.map((o) => ((o.resolvedAt ?? o.updatedAt) - o.createdAt) / 36e5);
    const systems = [...new Set(ts.map((o) => o.system))];
    const rows = systems.map((label) => ({ label, n: ts.filter((o) => o.system === label).length }));
    const max = Math.max(1, ...rows.map((r) => r.n));
    return {
      total: ts.length,
      open: ts.length - done.length,
      avg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      sla: done.length ? Math.round((done.filter((o) => !sla(o).late).length / done.length) * 100) : null,
      bySystem: rows.sort((a, b) => b.n - a.n).map((r) => ({ ...r, pct: (r.n / max) * 100 })),
    };
  });

  protected reportText() {
    const r = this.report();
    return [
      `📊 Resumo de atendimento — ${this.t().company}`,
      `• ${r.total} chamados (${r.open} ativos)`,
      `• Tempo médio de resolução: ${r.avg ?? '—'} h`,
      `• SLA cumprido: ${r.sla == null ? '—' : r.sla + '%'}`,
    ].join('\n');
  }
}
