import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CHANNELS, COMPANIES, Channel, Company, PRIORITIES, Priority, STATUSES, SYSTEMS, Store, System, ago, badge, code, isClosed, sla } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-tickets',
  imports: [Icon],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <span class="eyebrow">Atendimento</span>
          <h1>Tickets</h1>
          <p>{{ filtered().length }} de {{ store.tickets().length }} chamados</p>
        </div>
        <button class="btn btn-primary" (click)="dialog().nativeElement.showModal()"><app-icon name="plus" /> Novo chamado</button>
      </div>

      <div class="toolbar">
        <input #q class="input grow" placeholder="Buscar por código, título ou descrição…" (input)="query.set(q.value)" />
        <select #st class="input" (change)="status.set(st.value)">
          <option value="">Abertos (todos ativos)</option>
          <option value="*">Todos os status</option>
          @for (s of statuses; track s) { <option>{{ s }}</option> }
        </select>
        <select #sy class="input" (change)="system.set(sy.value)">
          <option value="">Todos os sistemas</option>
          @for (s of systems; track s) { <option>{{ s }}</option> }
        </select>
        <select #co class="input" (change)="company.set(co.value)">
          <option value="">Todas as empresas</option>
          @for (c of companies; track c) { <option>{{ c }}</option> }
        </select>
        <button class="btn" [class.on]="mine()" (click)="mine.set(!mine())">Meus chamados</button>
      </div>

      <div class="card">
        <ul class="list tickets">
          @for (t of filtered(); track t.id) {
            <li class="clickable" (click)="open(t.id)">
              <i class="dot" [class]="badge(t.priority)" [title]="'Prioridade ' + t.priority"></i>
              <div class="grow">
                <div class="t-head"><b class="code">{{ code(t) }}</b><strong>{{ t.title }}</strong></div>
                <p class="t-desc">{{ t.description }}</p>
                <small class="muted">{{ t.company }} · {{ t.system }} · {{ t.requester }} · atualizado {{ ago(t.updatedAt) }}</small>
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
    </div>

    <dialog #dlg>
      <form method="dialog" (submit)="create($event)">
        <div class="dialog-head"><h2>Novo chamado</h2>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
        </div>
        <div class="dialog-body form">
          <label class="field full">Título<input class="input" name="title" required maxlength="120" /></label>
          <label class="field">Empresa
            <select class="input" name="company">@for (c of companies; track c) { <option>{{ c }}</option> }</select>
          </label>
          <label class="field">Sistema
            <select class="input" name="system">@for (s of systems; track s) { <option>{{ s }}</option> }</select>
          </label>
          <label class="field">Prioridade
            <select class="input" name="priority">@for (p of priorities; track p) { <option [selected]="p === 'Média'">{{ p }}</option> }</select>
          </label>
          <label class="field">Canal
            <select class="input" name="via">@for (c of channels; track c) { <option>{{ c }}</option> }</select>
          </label>
          <label class="field full">Solicitante<input class="input" name="requester" required /></label>
          <label class="field full">Descrição<textarea class="input" name="description" required rows="4"></textarea></label>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="dlg.close()">Cancelar</button>
          <button class="btn btn-primary">Abrir chamado</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Tickets {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly statuses = STATUSES;
  protected readonly systems = SYSTEMS;
  protected readonly companies = COMPANIES;
  protected readonly priorities = PRIORITIES;
  protected readonly channels = CHANNELS;
  protected readonly ago = ago;
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly sla = sla;

  protected readonly query = signal('');
  protected readonly status = signal('');
  protected readonly system = signal('');
  protected readonly company = signal('');
  protected readonly mine = signal(false);

  private readonly rank: Record<Priority, number> = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const st = this.status();
    const me = this.store.user().name;
    return this.store
      .tickets()
      .filter(
        (t) =>
          (st === '*' || (st ? t.status === st : !isClosed(t))) &&
          (!this.system() || t.system === this.system()) &&
          (!this.company() || t.company === this.company()) &&
          (!this.mine() || t.assignee === me) &&
          (!q || `${code(t)} ${t.title} ${t.description}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => this.rank[a.priority] - this.rank[b.priority] || b.updatedAt - a.updatedAt);
  });

  open(id: number) {
    this.router.navigate(['/tickets', id]);
  }

  create(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const id = this.store.createTicket({
      title: f['title'].trim(),
      description: f['description'].trim(),
      requester: f['requester'].trim(),
      company: f['company'] as Company,
      system: f['system'] as System,
      priority: f['priority'] as Priority,
      via: f['via'] as Channel,
    });
    form.reset();
    this.open(id);
  }
}
