import { Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Article, SYSTEMS, Store, System, ago, initials } from '../data';
import { Icon } from '../ui';
import { Select, toOptions } from '../select';

@Component({
  selector: 'app-kb',
  imports: [Icon, RouterLink, NgTemplateOutlet, Select],
  template: `
    @if (article(); as a) {
      <div class="page narrow dark-ui">
        <a [routerLink]="base()" class="back"><app-icon name="back" /> Base de conhecimento</a>
        <article class="card post post-full">
          <header class="post-head">
            <span class="avatar">{{ initials(a.author) }}</span>
            <div class="post-who"><strong>{{ a.author }}</strong><small class="muted">Equipe AIOA · {{ ago(a.updatedAt) }}</small></div>
            <span class="post-tag">{{ a.system }}</span>
          </header>
          <h1 class="post-title">{{ a.title }}</h1>
          <p class="kb-summary">{{ a.summary }}</p>
          <div class="kb-body">{{ a.body }}</div>
          <ng-container *ngTemplateOutlet="actions; context: { $implicit: a }" />
        </article>
        <div class="card card-body kb-help">
          <span>Não resolveu?</span>
          <a class="btn btn-accent" [routerLink]="portal() ? '/portal/novo' : '/tickets'"><app-icon name="ticket" /> Abrir um chamado</a>
        </div>
      </div>
    } @else {
      <div class="page wide dark-ui">
        <div class="page-head">
          <div><span class="eyebrow">Autoatendimento</span><h1>Base de conhecimento</h1>
            <p>Artigos oficiais da equipe AIOA sobre os sistemas Lex.</p></div>
        </div>

        <div class="feed-layout">
          <section class="feed" aria-label="Artigos">
            @if (!portal()) {
              <button class="card composer-post" (click)="dlg.showModal()">
                <span class="avatar">{{ initials(me()) }}</span>
                <span class="composer-hint">Compartilhe um artigo com os clientes…</span>
                <span class="btn btn-accent"><app-icon name="plus" /> Publicar</span>
              </button>
            }

            @for (a of list(); track a.id) {
              <article class="card post">
                <header class="post-head">
                  <span class="avatar">{{ initials(a.author) }}</span>
                  <div class="post-who"><strong>{{ a.author }}</strong><small class="muted">Equipe AIOA · {{ ago(a.updatedAt) }}</small></div>
                  <button class="post-tag" (click)="system.set(a.system)" [title]="'Ver só ' + a.system">{{ a.system }}</button>
                </header>
                <a class="post-body" [routerLink]="[base(), a.id]" (click)="store.viewArticle(a.id)">
                  <h2 class="post-title">{{ a.title }}</h2>
                  <p>{{ a.summary }}</p>
                  <div class="post-preview"><div class="clamp">{{ a.body }}</div></div>
                </a>
                <ng-container *ngTemplateOutlet="actions; context: { $implicit: a }" />
              </article>
            } @empty {
              <div class="card empty">Nenhum artigo encontrado.</div>
            }
          </section>

          <aside class="feed-rail">
            <div class="card rail-card">
              <input #q class="input" placeholder="Buscar artigos…" (input)="query.set(q.value)" aria-label="Buscar artigos" />
            </div>
            <div class="card rail-card">
              <h3>Sistemas</h3>
              <div class="chips">
                <button class="chip-btn" [class.on]="!system()" (click)="system.set('')">Todos</button>
                @for (s of systems; track s) {
                  <button class="chip-btn" [class.on]="system() === s" (click)="system.set(s)">{{ s }}</button>
                }
              </div>
            </div>
            <div class="card rail-card">
              <h3>Em alta</h3>
              <ol class="trending">
                @for (a of trending(); track a.id; let i = $index) {
                  <li>
                    <span class="trend-pos">{{ i + 1 }}</span>
                    <a [routerLink]="[base(), a.id]" (click)="store.viewArticle(a.id)">
                      <small class="muted">{{ a.system }}</small>
                      <strong>{{ a.title }}</strong>
                      <small class="muted">{{ a.views }} visualizações · {{ (a.likes ?? []).length }} curtidas</small>
                    </a>
                  </li>
                }
              </ol>
            </div>
          </aside>
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
              <app-select name="system" label="Sistema" [options]="systemOptions" [value]="systems[0]" />
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

    <ng-template #actions let-a>
      <footer class="post-actions">
        <button class="post-act" [class.liked]="liked(a)" [attr.aria-pressed]="liked(a)" (click)="store.toggleLike(a.id, me())"
          [attr.aria-label]="liked(a) ? 'Descurtir' : 'Curtir'">
          <app-icon name="heart" /> {{ (a.likes ?? []).length }}
        </button>
        <span class="post-act static" title="Visualizações"><app-icon name="eye" /> {{ a.views }}</span>
        <button class="post-act" (click)="share(a)" aria-label="Copiar link do artigo">
          <app-icon name="share" /> {{ copied() === a.id ? 'Link copiado!' : 'Compartilhar' }}
        </button>
        @if (!article()) {
          <a class="post-read" [routerLink]="[base(), a.id]" (click)="store.viewArticle(a.id)">Ler artigo →</a>
        }
      </footer>
    </ng-template>
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
  protected readonly systemOptions = toOptions(SYSTEMS);
  protected readonly ago = ago;
  protected readonly initials = initials;
  protected readonly query = signal('');
  protected readonly system = signal('');
  protected readonly copied = signal<number | null>(null);

  /** Who is reading: the customer in the portal, the agent otherwise. */
  protected readonly me = computed(() => (this.portal() ? this.store.portalUser()?.name : undefined) ?? this.store.user().name);

  protected readonly article = computed(() => this.store.articles().find((a) => a.id === Number(this.id())));
  /** Feed order: newest first. */
  protected readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .articles()
      .filter((a: Article) => (!this.system() || a.system === this.system()) && (!q || `${a.title} ${a.summary} ${a.body}`.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });
  protected readonly trending = computed(() => [...this.store.articles()].sort((a, b) => b.views - a.views).slice(0, 5));

  protected liked(a: Article) {
    return (a.likes ?? []).includes(this.me());
  }

  protected share(a: Article) {
    void navigator.clipboard?.writeText(`${location.origin}${this.base()}/${a.id}`);
    this.copied.set(a.id);
    setTimeout(() => this.copied.set(null), 2000);
  }

  create(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    this.store.createArticle({ title: f['title'].trim(), system: f['system'] as System, summary: f['summary'].trim(), body: f['body'].trim() });
    form.reset();
    this.router.navigate(['/kb', this.store.articles()[0].id]);
  }
}
