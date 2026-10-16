import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANIES, CUSTOMERS, Company, Store, ago, badge, code, initials, isClosed, sla } from '../data';

@Component({
  selector: 'app-customers',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Carteira</span><h1>Clientes</h1>
          <p>{{ rows().length }} empresas atendidas pela AIOA.</p></div>
        <a class="btn" routerLink="/portal/login">Abrir portal do cliente</a>
      </div>

      <div class="grid cust-grid">
        @for (r of rows(); track r.company) {
          <button class="card cust-card" [class.selected]="selected() === r.company" (click)="selected.set(selected() === r.company ? null : r.company)">
            <div class="cust-head">
              <span class="avatar">{{ initials(r.company) }}</span>
              <div><strong>{{ r.company }}</strong><small class="muted">{{ r.info.city }} · cliente desde {{ r.info.since }}</small></div>
            </div>
            <div class="cust-stats">
              <div><b>{{ r.open }}</b><small>Ativos</small></div>
              <div><b>{{ r.closed }}</b><small>Resolvidos</small></div>
              <div><b [class.sla-late]="r.late">{{ r.late }}</b><small>Atrasados</small></div>
            </div>
            <div class="cust-systems">@for (s of r.info.systems; track s) { <span class="badge">{{ s }}</span> }</div>
            <small class="muted">{{ r.info.contact }} · {{ r.info.email }} · {{ r.info.phone }}</small>
          </button>
        }
      </div>

      @if (selected(); as c) {
        <div class="card">
          <div class="card-head"><h2>Chamados de {{ c }}</h2><span class="muted">{{ tickets().length }} no total</span></div>
          <ul class="list tickets">
            @for (t of tickets(); track t.id) {
              <li class="clickable" [routerLink]="['/tickets', t.id]">
                <i class="dot" [class]="badge(t.priority)"></i>
                <div class="grow"><div class="t-head"><b class="code">{{ code(t) }}</b><strong>{{ t.title }}</strong></div>
                  <small class="muted">{{ t.system }} · {{ t.requester }} · atualizado {{ ago(t.updatedAt) }}</small></div>
                <div class="t-side"><span [class]="badge(t.status)">{{ t.status }}</span>
                  <small class="muted" [class.sla-late]="sla(t).late">{{ sla(t).label }}</small></div>
              </li>
            } @empty {
              <li class="empty">Nenhum chamado para este cliente.</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class Customers {
  private readonly store = inject(Store);
  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly initials = initials;
  protected readonly sla = sla;
  protected readonly selected = signal<Company | null>(null);

  protected readonly rows = computed(() =>
    COMPANIES.map((company) => {
      const ts = this.store.tickets().filter((t) => t.company === company);
      const active = ts.filter((t) => !isClosed(t));
      return { company, info: CUSTOMERS[company], open: active.length, closed: ts.length - active.length, late: active.filter((t) => sla(t).late).length };
    }),
  );

  protected readonly tickets = computed(() =>
    this.store.tickets().filter((t) => t.company === this.selected()).sort((a, b) => b.updatedAt - a.updatedAt),
  );
}
