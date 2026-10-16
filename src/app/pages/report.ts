import { Component, computed, inject, signal } from '@angular/core';
import { COMPANIES, SYSTEMS, Store, isClosed, sla } from '../data';
import { Icon } from '../ui';

const DAY = 864e5;

@Component({
  selector: 'app-report',
  imports: [Icon],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Relatórios</span><h1>Report</h1><p>Desempenho do suporte por empresa e sistema.</p></div>
        <div class="toolbar">
          <select #p class="input" (change)="days.set(+p.value)" aria-label="Período">
            <option value="7">Últimos 7 dias</option>
            <option value="30" selected>Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="0">Todo o período</option>
          </select>
          <button class="btn" (click)="exportCsv()"><app-icon name="download" /> Exportar CSV</button>
        </div>
      </div>

      @for (table of tables(); track table.title) {
        <div class="card">
          <div class="card-head"><h2>{{ table.title }}</h2></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>{{ table.col }}</th><th class="num">Total</th><th class="num">Ativos</th><th class="num">Resolvidos</th>
                  <th class="num">Tempo médio (h)</th><th class="num">SLA cumprido</th></tr>
              </thead>
              <tbody>
                @for (r of table.rows; track r.label) {
                  <tr><td>{{ r.label }}</td><td class="num">{{ r.total }}</td><td class="num">{{ r.open }}</td><td class="num">{{ r.closed }}</td>
                    <td class="num">{{ r.avg ?? '—' }}</td><td class="num">{{ r.sla == null ? '—' : r.sla + '%' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class Report {
  private readonly store = inject(Store);
  protected readonly days = signal(30);

  private readonly inRange = computed(() => {
    const from = this.days() ? Date.now() - this.days() * DAY : 0;
    return this.store.tickets().filter((t) => t.createdAt >= from);
  });

  private rows(labels: readonly string[], key: 'company' | 'system') {
    return labels.map((label) => {
      const ts = this.inRange().filter((t) => t[key] === label);
      const done = ts.filter(isClosed);
      const hrs = done.map((t) => ((t.resolvedAt ?? t.updatedAt) - t.createdAt) / 36e5);
      return {
        label,
        total: ts.length,
        open: ts.length - done.length,
        closed: done.length,
        avg: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
        sla: done.length ? Math.round((done.filter((t) => !sla(t).late).length / done.length) * 100) : null,
      };
    });
  }

  protected readonly tables = computed(() => [
    { title: 'Por empresa', col: 'Empresa', rows: this.rows(COMPANIES, 'company') },
    { title: 'Por sistema', col: 'Sistema', rows: this.rows(SYSTEMS, 'system') },
  ]);

  exportCsv() {
    const lines = ['Agrupamento;Item;Total;Ativos;Resolvidos;Tempo medio (h);SLA cumprido (%)'];
    for (const t of this.tables())
      for (const r of t.rows) lines.push([t.col, r.label, r.total, r.open, r.closed, r.avg ?? '', r.sla ?? ''].join(';'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `aioa-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
