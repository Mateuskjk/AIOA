import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Company, SYSTEMS, Store, System, customerTabId, fmt, initials, isClosed, isResolved, sla } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-customers',
  imports: [Icon],
  template: `
    <div class="page wide dark-ui">
      <div class="page-head">
        <div><span class="eyebrow">Carteira</span><h1>Clientes</h1>
          <p>{{ rows().length }} empresas atendidas pela AIOA.</p></div>
        <button class="btn btn-accent" (click)="openNew(dlg)"><app-icon name="plus" /> Novo cliente</button>
      </div>

      @if (created(); as c) {
        <div class="card notice-bar" role="status">
          <app-icon name="check" /> <span><b>{{ c }}</b> cadastrado. A aba já está disponível em Tickets.</span>
          <button class="tt-x" aria-label="Fechar aviso" (click)="created.set(null)"><app-icon name="x" /></button>
        </div>
      }

      <div class="grid cust-grid">
        @for (r of rows(); track r.c.name) {
          <button class="card cust-card" (click)="openCompany(r.c.name)" [attr.aria-label]="'Abrir ' + r.c.name">
            <div class="cust-head">
              <span class="avatar">{{ initials(r.c.name) }}</span>
              <div><strong>{{ r.c.name }}</strong><small class="muted">{{ r.c.city || 'Cidade não informada' }} · cliente desde {{ r.c.since }}</small></div>
              <span class="cust-short">{{ r.c.short }}</span>
            </div>
            <div class="cust-stats">
              <div><b>{{ r.open }}</b><small>Ativos</small></div>
              <div><b>{{ r.closed }}</b><small>Resolvidos</small></div>
              <div><b [class.sla-late]="r.late">{{ r.late }}</b><small>Atrasados</small></div>
            </div>
            <div class="cust-systems">@for (s of r.c.systems; track s) { <span class="badge">{{ s }}</span> }</div>
            <small class="muted cust-members"><app-icon name="users" /> {{ r.c.members.length }} {{ r.c.members.length === 1 ? 'membro' : 'membros' }}</small>
          </button>
        }
      </div>
    </div>

    <!-- Company: info header, members, add member -->
    <dialog #companyDlg class="company-dlg dark-ui" (close)="memberError.set('')">
      @if (current(); as r) {
        <header class="co-head">
          <span class="avatar co-avatar">{{ initials(r.c.name) }}</span>
          <div class="co-title">
            <div class="co-name"><h2>{{ r.c.name }}</h2><span class="cust-short">{{ r.c.short }}</span></div>
            <small class="muted">{{ r.c.city || 'Cidade não informada' }} · cliente desde {{ r.c.since }}</small>
          </div>
          <button class="icon-btn" aria-label="Fechar" (click)="companyDlg.close()"><app-icon name="x" /></button>
        </header>

        <div class="co-body">
          <div class="co-info">
            <dl>
              <dt>Contato principal</dt><dd>{{ r.c.contact }}</dd>
              <dt>E-mail</dt><dd>{{ r.c.email || '—' }}</dd>
              <dt>Telefone</dt><dd>{{ r.c.phone || '—' }}</dd>
            </dl>
            <div class="co-systems">
              <span class="co-label">Sistemas com acesso</span>
              <div class="chips">
                @for (s of systems; track s) {
                  <button class="chip-btn" [class.on]="r.c.systems.includes(s)" [attr.aria-pressed]="r.c.systems.includes(s)" (click)="toggleSystem(r.c.name, r.c.systems, s)">{{ s }}</button>
                }
              </div>
            </div>
            <div class="cust-stats">
              <div><b>{{ r.open }}</b><small>Ativos</small></div>
              <div><b>{{ r.closed }}</b><small>Resolvidos</small></div>
              <div><b [class.sla-late]="r.late">{{ r.late }}</b><small>Atrasados</small></div>
            </div>
            <button class="btn" (click)="seeTickets(r.c.short)"><app-icon name="ticket" /> Ver tickets da empresa</button>
          </div>

          <section class="co-members">
            <h3>Membros <small class="muted">· usuários-cliente com acesso ao portal</small></h3>
            <p class="muted co-access">
              Os membros abrem chamados para
              @if (r.c.systems.length) { {{ r.c.systems.join(', ') }} e Outros. } @else { Outros (nenhum sistema contratado). }
            </p>
            <ul class="member-list">
              @for (m of r.c.members; track m.email) {
                <li>
                  <span class="avatar sm">{{ initials(m.name) }}</span>
                  <div class="grow"><strong>{{ m.name }}</strong><small class="muted">{{ m.email }} · {{ m.role }} · desde {{ fmt(m.since) }}</small></div>
                  <small class="muted member-count" [title]="'Chamados abertos por ' + m.name">{{ opened(m.name) }} chamados</small>
                  <button class="tt-x" [attr.aria-label]="'Remover ' + m.name" title="Remover acesso" (click)="removeMember(r.c.name, m.email, m.name)"><app-icon name="trash" /></button>
                </li>
              } @empty {
                <li class="muted">Nenhum membro ainda. Cadastre alguém para que a empresa possa abrir chamados.</li>
              }
            </ul>

            <form class="member-form" (submit)="addMember($event, r.c.name)">
              <h4>Novo membro</h4>
              <div class="member-fields">
                <input class="input" name="name" required placeholder="Nome" aria-label="Nome" />
                <input class="input" name="email" type="email" required placeholder="E-mail" aria-label="E-mail" />
                <input class="input" name="role" placeholder="Cargo (opcional)" aria-label="Cargo" />
                <button class="btn btn-accent"><app-icon name="plus" /> Adicionar</button>
              </div>
              @if (memberError()) { <p class="form-error" role="alert">{{ memberError() }}</p> }
            </form>
          </section>
        </div>
      }
    </dialog>

    <dialog #dlg>
      <form method="dialog" (submit)="create($event, dlg)">
        <div class="dialog-head"><h2>Novo cliente</h2>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
        </div>
        <div class="dialog-body form">
          <label class="field full">Nome da empresa<input class="input" name="name" required maxlength="80" placeholder="Ex.: Souza & Lima Advogados" /></label>
          <label class="field">Sigla da aba<input class="input" name="short" required maxlength="14" placeholder="Ex.: SL" style="text-transform: uppercase" /></label>
          <label class="field">Contato principal<input class="input" name="contact" required placeholder="Nome de quem abre chamados" /></label>
          <label class="field">E-mail<input class="input" name="email" type="email" required placeholder="contato@empresa.com" /></label>
          <label class="field">Telefone<input class="input" name="phone" type="tel" placeholder="(11) 4000-0000" /></label>
          <label class="field full">Cidade<input class="input" name="city" placeholder="Cidade - UF" /></label>
          <fieldset class="field full sys-pick">
            <legend>Sistemas contratados</legend>
            @for (s of systems; track s) {
              <label class="check"><input type="checkbox" name="systems" [value]="s" /> {{ s }}</label>
            }
          </fieldset>
          @if (error()) { <p class="form-error full" role="alert">{{ error() }}</p> }
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="dlg.close()">Cancelar</button>
          <button class="btn btn-primary">Cadastrar cliente</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Customers {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly systems = SYSTEMS.filter((s) => s !== 'Outros');
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly selected = signal<Company | null>(null);
  protected readonly created = signal<Company | null>(null);
  protected readonly error = signal('');
  protected readonly memberError = signal('');
  private readonly companyDialog = viewChild.required<ElementRef<HTMLDialogElement>>('companyDlg');

  protected readonly rows = computed(() =>
    this.store.customers().map((c) => {
      const ts = this.store.tickets().filter((t) => t.company === c.name);
      const active = ts.filter((t) => !isClosed(t));
      return { c, open: active.length, closed: ts.filter(isResolved).length, late: active.filter((t) => sla(t).late).length };
    }),
  );
  protected readonly current = computed(() => this.rows().find((r) => r.c.name === this.selected()));

  protected toggleSystem(company: Company, current: System[], s: System) {
    const next = current.includes(s) ? current.filter((x) => x !== s) : this.systems.filter((x) => x === s || current.includes(x));
    this.store.setSystems(company, next);
  }

  protected opened(name: string) {
    return this.store.tickets().filter((t) => t.requester === name).length;
  }

  protected openCompany(name: Company) {
    this.selected.set(name);
    this.companyDialog().nativeElement.showModal();
  }

  /** Opens Tickets on this company's tab. */
  protected seeTickets(short: string) {
    try {
      localStorage.setItem('aioa:ticket-tab', JSON.stringify(customerTabId(short)));
    } catch {}
    this.companyDialog().nativeElement.close();
    this.router.navigate(['/tickets']);
  }

  protected addMember(e: Event, company: Company) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const err = this.store.addMember(company, { name: text('name'), email: text('email'), role: text('role') || 'Usuário' });
    this.memberError.set(err);
    if (!err) form.reset();
  }

  protected removeMember(company: Company, email: string, name: string) {
    if (confirm(`Remover o acesso de ${name}? Os chamados que ele já abriu continuam no sistema.`)) this.store.removeMember(company, email);
  }

  protected openNew(dlg: HTMLDialogElement) {
    this.error.set('');
    dlg.showModal();
  }

  protected create(e: Event, dlg: HTMLDialogElement) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    const name = text('name');
    const now = Date.now();
    const since = new Date(now).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/');
    const ok = this.store.createCustomer({
      name,
      short: text('short').toUpperCase(),
      contact: text('contact'),
      email: text('email'),
      phone: text('phone'),
      city: text('city'),
      since,
      systems: f.getAll('systems') as System[],
      // The main contact is the first member, so the company can use the portal right away.
      members: [{ name: text('contact'), email: text('email'), role: 'Contato principal', since: now }],
    });
    if (!ok) {
      this.error.set(`Já existe um cliente chamado "${name}".`);
      return;
    }
    form.reset();
    dlg.close();
    this.created.set(name);
  }
}
