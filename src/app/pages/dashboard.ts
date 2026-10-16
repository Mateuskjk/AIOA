import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANIES, SYSTEMS, Store, ago, badge, code, isClosed, sla } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-dashboard',
  imports: [Icon, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <span class="eyebrow">Dashboard</span>
          <h1>Olá, {{ store.user().name.split(' ')[0] }} 👋</h1>
          <p>Sua operação de suporte em tempo real.</p>
        </div>
        <a class="btn btn-primary" routerLink="/tickets"><app-icon name="ticket" /> Ver tickets</a>
      </div>

      <div class="grid kpis">
        <div class="card kpi dark"><span class="label"><app-icon name="ticket" /> Chamados ativos</span><span class="value">{{ stats().open }}</span></div>
        <div class="card kpi"><span class="label"><app-icon name="flame" /> Urgentes</span><span class="value">{{ stats().urgent }}</span></div>
        <div class="card kpi"><span class="label"><app-icon name="alert" /> SLA atrasado</span><span class="value" [class.sla-late]="stats().late">{{ stats().late }}</span></div>
        <div class="card kpi"><span class="label"><app-icon name="check" /> Resolvidos</span><span class="value">{{ stats().closed }}</span></div>
        <div class="card kpi"><span class="label"><app-icon name="clock" /> SLA cumprido</span><span class="value">{{ stats().slaPct }}%</span></div>
      </div>

      <div class="grid two">
        <div class="card">
          <div class="card-head"><h2>Ativos por sistema</h2></div>
          <div class="card-body bars">
            @for (r of bySystem(); track r.label) {
              <div class="bar-row"><span>{{ r.label }}</span><div class="bar"><i [style.width.%]="r.pct"></i></div><b>{{ r.n }}</b></div>
            }
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Ativos por empresa</h2></div>
          <div class="card-body bars">
            @for (r of byCompany(); track r.label) {
              <div class="bar-row"><span [title]="r.label">{{ r.label }}</span><div class="bar accent"><i [style.width.%]="r.pct"></i></div><b>{{ r.n }}</b></div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Precisam de atenção</h2><a class="muted" routerLink="/tickets">Ver todos</a></div>
        <ul class="list tickets">
          @for (t of attention(); track t.id) {
            <li class="clickable" [routerLink]="['/tickets', t.id]">
              <i class="dot" [class]="badge(t.priority)"></i>
              <div class="grow"><div class="t-head"><b class="code">{{ code(t) }}</b><strong>{{ t.title }}</strong></div>
                <small class="muted">{{ t.company }} · {{ t.system }} · {{ ago(t.updatedAt) }}</small></div>
              <div class="t-side"><span [class]="badge(t.status)">{{ t.status }}</span>
                <small class="muted" [class.sla-late]="sla(t).late">{{ sla(t).label }}</small></div>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class Dashboard {
  protected readonly store = inject(Store);
  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly sla = sla;

  private readonly active = computed(() => this.store.tickets().filter((t) => !isClosed(t)));

  protected readonly stats = computed(() => {
    const closed = this.store.tickets().filter(isClosed);
    const met = closed.filter((t) => !sla(t).late).length;
    return {
      open: this.active().length,
      urgent: this.active().filter((t) => t.priority === 'Urgente').length,
      late: this.active().filter((t) => sla(t).late).length,
      closed: closed.length,
      slaPct: closed.length ? Math.round((met / closed.length) * 100) : 100,
    };
  });

  private group(keys: readonly string[], key: 'system' | 'company') {
    const rows = keys.map((label) => ({ label, n: this.active().filter((t) => t[key] === label).length }));
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.map((r) => ({ ...r, pct: (r.n / max) * 100 }));
  }
  protected readonly bySystem = computed(() => this.group(SYSTEMS, 'system'));
  protected readonly byCompany = computed(() => this.group(COMPANIES, 'company'));

  protected readonly attention = computed(() =>
    [...this.active()].sort((a, b) => Number(sla(b).late) - Number(sla(a).late) || a.createdAt - b.createdAt).slice(0, 6),
  );
}
