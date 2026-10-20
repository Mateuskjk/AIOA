import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, Store, Ticket, countBy, duration, isClosed, isResolved, kpiStats, monthlyTrend, perAgentAverage } from '../data';
import { AreaChart, ColumnChart, Datum, Donut, Pie3D, RankBars } from '../charts';
import { Icon } from '../ui';

/** Pie order, as requested: Bug, Funcionalidade, Melhorias, Acesso, Suporte de T.I., Dashboard. */
const PIE_ORDER: Category[] = ['Bug', 'Funcionalidade', 'Melhorias', 'Acesso', 'Suporte de T.I.', 'Dashboard'];

@Component({
  selector: 'app-dashboard',
  imports: [Icon, RouterLink, AreaChart, ColumnChart, Donut, Pie3D, RankBars],
  template: `
    <div class="page wide">
      <div class="page-head">
        <div class="head-main">
          <span class="eyebrow">Dashboard</span>
          <div class="title-row">
            <h1>Olá, {{ store.user().name.split(' ')[0] }} 👋</h1>
            <a class="btn btn-accent" routerLink="/tickets"><app-icon name="ticket" /> Ver tickets</a>
          </div>
          <p>Sua operação de suporte em tempo real.</p>
        </div>
      </div>

      <div class="grid kpis">
        @for (k of kpis(); track k.label) {
          <a class="card kpi" routerLink="/tickets" [attr.aria-label]="k.label + ': ' + k.value + '. Ver tickets'">
            <span class="label"><span class="kpi-icon" [class]="'kpi-icon tone-' + k.tone"><app-icon [name]="k.icon" /></span>{{ k.label }}</span>
            <span class="value">{{ k.value }}</span>
            <small class="kpi-hint">{{ k.hint }}</small>
          </a>
        }
      </div>

      <div class="grid charts">
        <section class="chart-card">
          <h2 class="chart-title">Tickets abertos por empresa</h2>
          <app-column-chart [data]="openByCompany()" unit="em aberto" aria="Tickets em aberto por empresa" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">Tickets por categoria</h2>
          <app-pie-3d [data]="byCategory()" unit="tickets" aria="Tickets por categoria" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">Encerrados por empresa</h2>
          <app-column-chart [data]="resolvedByCompany()" unit="encerrados" aria="Tickets encerrados por empresa" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">Usuários que mais abrem tickets</h2>
          <app-rank-bars [data]="openers()" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">Subcategorias</h2>
          <app-donut [data]="bySubcategory()" unit="tickets" aria="Tickets por subcategoria" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">HelpDeskers que mais fecham tickets</h2>
          <app-rank-bars [data]="closers()" />
        </section>
      </div>

      <div class="grid two">
        <section class="chart-card">
          <h2 class="chart-title">Tickets por mês</h2>
          <app-area-chart [data]="perMonth()" unit="tickets abertos" aria="Tickets abertos por mês nos últimos 12 meses" />
        </section>
        <section class="chart-card">
          <h2 class="chart-title">Média de encerrados por HelpDesker</h2>
          <app-area-chart [data]="perAgent()" unit="encerrados por mês" aria="Média mensal de tickets encerrados por HelpDesker" />
        </section>
      </div>
    </div>
  `,
})
export class Dashboard {
  protected readonly store = inject(Store);

  protected readonly kpis = computed(() => {
    const k = kpiStats(this.store.tickets());
    const pct = (n: number) => (k.total ? `${Math.round((n / k.total) * 100)}% do total` : '—');
    return [
      { label: 'Total de tickets', icon: 'ticket', tone: 'navy', value: k.total, hint: 'Todos os chamados registrados' },
      { label: 'Aguardando atendimento', icon: 'hourglass', tone: 'amber', value: k.waiting, hint: 'Abertos, sem início' },
      { label: 'Em atendimento', icon: 'headset', tone: 'lavender', value: k.inProgress, hint: 'Em andamento ou aguardando cliente' },
      { label: 'Encerrados', icon: 'check', tone: 'green', value: k.resolved, hint: pct(k.resolved) },
      { label: 'Cancelados', icon: 'circle-x', tone: 'gray', value: k.cancelled, hint: pct(k.cancelled) },
      { label: 'Reprovados', icon: 'thumbs-down', tone: 'red', value: k.rejected, hint: pct(k.rejected) },
      { label: 'Duração do atendimento', icon: 'timer', tone: 'blue', value: k.avgHours == null ? '—' : duration(k.avgHours), hint: 'Média até a resolução' },
      { label: 'Taxa de resolução', icon: 'trending-up', tone: 'green', value: k.rate == null ? '—' : `${k.rate}%`, hint: `Resolvidos de ${k.finished} finalizados` },
    ];
  });

  /** Companies with at least one ticket, largest first, labelled by their short code. */
  private perCompany(ts: Ticket[]): Datum[] {
    return this.store.customers().map((c) => ({ label: c.short, name: c.name, value: ts.filter((t) => t.company === c.name).length }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }
  protected readonly openByCompany = computed(() => this.perCompany(this.store.tickets().filter((t) => !isClosed(t))));
  protected readonly resolvedByCompany = computed(() => this.perCompany(this.store.tickets().filter(isResolved)));
  /** Top 5 requesters and closers. */
  protected readonly openers = computed(() => countBy(this.store.tickets().map((t) => t.requester), 5));
  protected readonly closers = computed(() =>
    countBy(this.store.tickets().filter(isResolved).map((t) => t.closedBy ?? t.assignee ?? '—'), 5),
  );

  /** Top 5 subcategories; the rest fold into "Outras". */
  protected readonly bySubcategory = computed(() => {
    const all = countBy(this.store.tickets().map((t) => t.subcategory));
    const rest = all.slice(5).reduce((a, r) => a + r.value, 0);
    return [...all.slice(0, 5), ...(rest ? [{ label: 'Outras', value: rest }] : [])];
  });

  /** Trends: tickets opened per month (12 months) and each HelpDesker's monthly average of resolved tickets. */
  protected readonly perMonth = computed(() => monthlyTrend(this.store.tickets()).map((m) => ({ label: m.label, value: m.opened })));
  protected readonly perAgent = computed(() => perAgentAverage(this.store.tickets()));

  protected readonly byCategory = computed(() =>
    PIE_ORDER.map((c) => ({ label: c, value: this.store.tickets().filter((t) => t.category === c).length })),
  );
}
