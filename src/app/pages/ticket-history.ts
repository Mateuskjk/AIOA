import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AGENTS, Store, Transcript, fmt, initials, transcriptEntries, transcriptHtml } from '../data';
import { Attachments } from '../composer';
import { Icon } from '../ui';
import { Select } from '../select';
import { Backend } from '../backend';

@Component({
  selector: 'app-ticket-history',
  imports: [Icon, RouterLink, Attachments, Select],
  template: `
    <div class="page wide dark-ui th-page">
      <div class="page-head">
        <div><span class="eyebrow">Arquivo</span><h1>Histórico de tickets</h1>
          <p>Transcrições completas — texto, imagens e áudios — gravadas ao encerrar cada chamado.</p></div>
      </div>

      <div class="th-grid">
        <aside class="card th-side">
          <div class="th-filters">
            <input #q class="input" placeholder="Buscar por código, título ou conversa…" aria-label="Buscar transcrições" (input)="query.set(q.value)" />
            @if (!portal()) {
              <app-select label="Empresa" [options]="companyOptions()" [(value)]="company" />
            }
            <small class="muted">{{ plural(list().length, 'transcrição', 'transcrições') }}</small>
          </div>
          <ul class="th-list">
            @for (tr of list(); track tr.id) {
              <li>
                <button class="th-item" [class.active]="tr.id === current()?.id" (click)="selected.set(tr.id)">
                  <app-icon name="file-text" />
                  <span class="grow">
                    <span class="t-head"><b class="code">{{ tr.code }}</b><strong>{{ tr.title }}</strong></span>
                    <small class="muted">{{ short(tr.company) }} · {{ tr.system }} · {{ fmt(tr.at) }}</small>
                  </span>
                </button>
              </li>
            } @empty {
              <li class="empty">Nenhuma transcrição encontrada.</li>
            }
          </ul>
        </aside>

        @if (current(); as tr) {
          <article class="card th-view">
            <header class="th-head">
              <div class="th-title">
                <div class="t-head"><b class="code">{{ tr.code }}</b><h2>{{ tr.title }}</h2></div>
                <small class="muted">{{ tr.company }} · solicitante {{ tr.requester }} · responsável {{ tr.assignee ?? '—' }} · encerrado em {{ fmt(tr.at) }} por {{ tr.by }}</small>
                <div class="th-stats">
                  <span><app-icon name="forum" /> {{ plural(stats().messages, 'mensagem', 'mensagens') }}</span>
                  <span><app-icon name="paperclip" /> {{ plural(stats().images, 'imagem', 'imagens') }}</span>
                  <span><app-icon name="mic" /> {{ plural(stats().audios, 'áudio', 'áudios') }}</span>
                  <span><app-icon name="file-text" /> {{ plural(stats().files, 'arquivo', 'arquivos') }}</span>
                </div>
              </div>
              <div class="th-actions">
                @if (!portal()) {
                  <a class="btn" [routerLink]="['/tickets', tr.ticketId]"><app-icon name="ticket" /> Abrir ticket</a>
                  <button class="btn" (click)="downloadTxt(tr)"><app-icon name="download" /> .txt</button>
                }
                <button class="btn btn-accent" (click)="downloadHtml(tr)" title="Conversa com imagens e áudios embutidos"><app-icon name="download" /> Transcrição completa (.html)</button>
              </div>
            </header>

            <ol class="timeline th-thread">
              @for (e of entries(); track $index) {
                @if (e.kind === 'event') {
                  <li class="event"><span class="ev-icon"><app-icon name="clock" /></span><span class="muted">{{ e.text }}</span><small class="muted">· {{ fmt(e.at) }}</small></li>
                } @else {
                  <li class="msg" [class.note]="e.internal">
                    <span class="avatar sm" [class.agent]="isAgent(e.author)">{{ initials(e.author) }}</span>
                    <div>
                      <header><strong>{{ e.author }}</strong>
                        @if (e.internal) { <span class="note-tag"><app-icon name="lock" /> Nota interna</span> }
                        <small class="muted">· {{ fmt(e.at) }} @if (e.via && !e.internal) { · via <span class="via">{{ e.via }}</span> }</small>
                      </header>
                      @if (e.body) { <p>{{ e.body }}</p> }
                      @if (e.files.length) { <app-attachments [files]="e.files" /> }
                    </div>
                  </li>
                }
              }
            </ol>
          </article>
        } @else {
          <div class="card empty">Selecione uma transcrição.</div>
        }
      </div>
    </div>
  `,
})
export class TicketHistory {
  /** Customer-portal mode (set via route data): only the user's own tickets, never the team's internal notes. */
  readonly portal = input(false);
  protected readonly store = inject(Store);
  private readonly backend = inject(Backend);
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly query = signal('');
  protected readonly company = signal('');
  protected readonly companyOptions = computed(() => [
    { value: '', label: 'Todas as empresas', icon: 'users' },
    ...this.store.customers().map((c) => ({ value: c.name, label: c.name, hint: c.short })),
  ]);
  protected readonly selected = signal<number | null>(null);

  protected readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .transcripts()
      .filter((tr) => (!this.company() || tr.company === this.company()) && (!q || `${tr.code} ${tr.title} ${this.portal() ? '' : tr.text}`.toLowerCase().includes(q)))
      .filter((tr) => !this.portal() || tr.requester === this.store.portalUser()?.name); // the customer sees only their own tickets
  });
  /** The picked transcript, or the newest one in the current filter. */
  protected readonly current = computed(() => this.list().find((tr) => tr.id === this.selected()) ?? this.list()[0]);

  /** The conversation as it was when the ticket was closed, media included. */
  protected readonly entries = computed(() => {
    const tr = this.current();
    const t = tr && this.store.ticket(tr.ticketId);
    const all = t ? transcriptEntries(t, tr.at) : [];
    return this.portal() ? all.filter((e) => e.kind === 'event' || !e.internal) : all;
  });

  protected readonly stats = computed(() => {
    const files = this.entries().flatMap((e) => (e.kind === 'msg' ? e.files : []));
    const images = files.filter((f) => f.type.startsWith('image/')).length;
    const audios = files.filter((f) => f.type.startsWith('audio/')).length;
    return { messages: this.entries().filter((e) => e.kind === 'msg').length, images, audios, files: files.length - images - audios };
  });

  protected plural(n: number, one: string, many: string) {
    return `${n} ${n === 1 ? one : many}`;
  }

  protected short(company: string) {
    return this.store.customers().find((c) => c.name === company)?.short ?? company;
  }

  protected isAgent(name: string) {
    return AGENTS.includes(name) || name === this.store.user().name;
  }

  /** The archived file from Storage when there is one, else the text rebuilt from the conversation. */
  protected async downloadTxt(tr: Transcript) {
    const file = tr.txtPath && this.backend.enabled ? await this.backend.transcriptFile(tr.txtPath) : null;
    this.save(file ?? new Blob(['﻿' + tr.text], { type: 'text/plain;charset=utf-8' }), `transcricao-${tr.code}.txt`);
  }

  protected downloadHtml(tr: Transcript) {
    const html = transcriptHtml(tr, this.entries());
    this.save(new Blob([html], { type: 'text/html;charset=utf-8' }), `transcricao-${tr.code}.html`);
  }

  private save(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
