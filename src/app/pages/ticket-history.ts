import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANIES, Store, Transcript, fmt } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-ticket-history',
  imports: [Icon, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Arquivo</span><h1>Histórico de tickets</h1>
          <p>Transcrições completas geradas ao resolver cada chamado.</p></div>
      </div>

      <div class="toolbar">
        <input #q class="input grow" placeholder="Buscar por código, título ou conteúdo da conversa…" aria-label="Buscar transcrições" (input)="query.set(q.value)" />
        <select #co class="input" aria-label="Empresa" (change)="company.set(co.value)">
          <option value="">Todas as empresas</option>
          @for (c of companies; track c) { <option>{{ c }}</option> }
        </select>
      </div>

      <div class="th-grid">
        <div class="card">
          <ul class="list">
            @for (tr of list(); track tr.id) {
              <li class="clickable" [class.th-active]="tr.id === current()?.id" (click)="selected.set(tr.id)">
                <app-icon name="file-text" />
                <div class="grow">
                  <div class="t-head"><b class="code">{{ tr.code }}</b><strong>{{ tr.title }}</strong></div>
                  <small class="muted">{{ tr.company }} · {{ tr.system }} · resolvido {{ fmt(tr.at) }}</small>
                </div>
              </li>
            } @empty {
              <li class="empty">Nenhuma transcrição encontrada.</li>
            }
          </ul>
        </div>

        @if (current(); as tr) {
          <article class="card th-view">
            <header class="card-head">
              <div>
                <div class="t-head"><b class="code">{{ tr.code }}</b><h2>{{ tr.title }}</h2></div>
                <small class="muted">Gerada por {{ tr.by }} em {{ fmt(tr.at) }} · {{ tr.requester }} · responsável {{ tr.assignee ?? '—' }}</small>
              </div>
              <div class="toolbar">
                <a class="btn btn-sm" [routerLink]="['/tickets', tr.ticketId]"><app-icon name="ticket" /> Abrir ticket</a>
                <button class="btn btn-sm" (click)="download(tr)"><app-icon name="download" /> Baixar .txt</button>
              </div>
            </header>
            <pre class="th-text">{{ tr.text }}</pre>
          </article>
        }
      </div>
    </div>
  `,
})
export class TicketHistory {
  private readonly store = inject(Store);
  protected readonly companies = COMPANIES;
  protected readonly fmt = fmt;
  protected readonly query = signal('');
  protected readonly company = signal('');
  protected readonly selected = signal<number | null>(null);

  protected readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .transcripts()
      .filter((tr) => (!this.company() || tr.company === this.company()) && (!q || `${tr.code} ${tr.title} ${tr.text}`.toLowerCase().includes(q)));
  });
  /** The picked transcript, or the newest one in the current filter. */
  protected readonly current = computed(() => this.list().find((tr) => tr.id === this.selected()) ?? this.list()[0]);

  protected download(tr: Transcript) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + tr.text], { type: 'text/plain;charset=utf-8' }));
    a.download = `transcricao-${tr.code}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
