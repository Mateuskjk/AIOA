import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Article, SYSTEMS, Store, System, ago } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-kb',
  imports: [Icon, RouterLink],
  template: `
    @if (article(); as a) {
      <div class="page narrow">
        <a [routerLink]="base()" class="back"><app-icon name="back" /> Base de conhecimento</a>
        <article class="card card-body kb-article">
          <span class="badge">{{ a.system }}</span>
          <h1>{{ a.title }}</h1>
          <small class="muted">Por {{ a.author }} · atualizado {{ ago(a.updatedAt) }} · {{ a.views }} visualizações</small>
          <p class="kb-summary">{{ a.summary }}</p>
          <div class="kb-body">{{ a.body }}</div>
        </article>
        <div class="card card-body kb-help">
          <span>Não resolveu?</span>
          <a class="btn btn-primary" [routerLink]="portal() ? '/portal/novo' : '/tickets'"><app-icon name="ticket" /> Abrir um chamado</a>
        </div>
      </div>
    } @else {
      <div class="page">
        <div class="page-head">
          <div><span class="eyebrow">Autoatendimento</span><h1>Base de conhecimento</h1>
            <p>Artigos oficiais da equipe AIOA sobre os sistemas Lex.</p></div>
          @if (!portal()) {
            <button class="btn btn-primary" (click)="dlg.showModal()"><app-icon name="plus" /> Novo artigo</button>
          }
        </div>

        <input #q class="input" placeholder="Buscar artigos…" (input)="query.set(q.value)" aria-label="Buscar artigos" />
        <div class="toolbar">
          <button class="btn" [class.on]="!system()" (click)="system.set('')">Todos</button>
          @for (s of systems; track s) {
            <button class="btn" [class.on]="system() === s" (click)="system.set(s)">{{ s }}</button>
          }
        </div>

        <div class="grid kb-grid">
          @for (a of list(); track a.id) {
            <a class="card kb-card" [routerLink]="[base(), a.id]" (click)="store.viewArticle(a.id)">
              <span class="badge">{{ a.system }}</span>
              <strong>{{ a.title }}</strong>
              <p class="muted">{{ a.summary }}</p>
              <small class="muted">{{ a.views }} visualizações · {{ ago(a.updatedAt) }}</small>
            </a>
          } @empty {
            <div class="empty">Nenhum artigo encontrado.</div>
          }
        </div>
      </div>

      <dialog #dlg>
        <form method="dialog" (submit)="create($event)">
          <div class="dialog-head"><h2>Novo artigo</h2>
            <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
          </div>
          <div class="dialog-body form">
            <label class="field full">Título<input class="input" name="title" required /></label>
            <label class="field full">Sistema
              <select class="input" name="system">@for (s of systems; track s) { <option>{{ s }}</option> }</select>
            </label>
            <label class="field full">Resumo<input class="input" name="summary" required maxlength="160" /></label>
            <label class="field full">Conteúdo<textarea class="input" name="body" required rows="8"></textarea></label>
          </div>
          <div class="dialog-foot">
            <button type="button" class="btn" (click)="dlg.close()">Cancelar</button>
            <button class="btn btn-primary">Publicar</button>
          </div>
        </form>
      </dialog>
    }
  `,
})
export class Kb {
  readonly id = input<string>();
  /** Customer-portal mode (set via route data): read-only, portal links. */
  readonly portal = input(false);
  protected readonly base = computed(() => (this.portal() ? '/portal/kb' : '/kb'));
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly systems = SYSTEMS;
  protected readonly ago = ago;
  protected readonly query = signal('');
  protected readonly system = signal('');

  protected readonly article = computed(() => this.store.articles().find((a) => a.id === Number(this.id())));
  protected readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .articles()
      .filter((a: Article) => (!this.system() || a.system === this.system()) && (!q || `${a.title} ${a.summary} ${a.body}`.toLowerCase().includes(q)))
      .sort((a, b) => b.views - a.views);
  });

  create(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    this.store.createArticle({ title: f['title'].trim(), system: f['system'] as System, summary: f['summary'].trim(), body: f['body'].trim() });
    form.reset();
    this.router.navigate(['/kb', this.store.articles()[0].id]);
  }
}
