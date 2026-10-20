import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SYSTEMS, Store, System, Topic, Votes, ago, initials, score } from '../data';
import { Icon } from '../ui';
import { Select } from '../select';

type Sort = 'hot' | 'new' | 'top';

/** "Ana Rocha" -> "ana.rocha" (Reddit-style handle). */
const handle = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

@Component({
  selector: 'app-forum',
  imports: [Icon, RouterLink, NgTemplateOutlet, Select],
  template: `
    @if (topic(); as t) {
      <div class="page wide dark-ui">
        <a [routerLink]="base()" class="back"><app-icon name="back" /> Fórum</a>
        <div class="feed-layout">
          <section class="feed">
            <article class="card rd-post rd-full">
              <ng-container *ngTemplateOutlet="voteCol; context: { votes: t.votes, topic: t.id }" />
              <div class="rd-main">
                <div class="rd-meta"><button class="rd-sub" (click)="openCommunity(t.system)">r/{{ t.system }}</button> · postado por u/{{ handle(t.author) }} · {{ ago(t.at) }}</div>
                <h1 class="rd-title">{{ t.title }}</h1>
                @if (t.body) { <p class="rd-text">{{ t.body }}</p> }
                <div class="rd-foot"><span class="rd-act static"><app-icon name="forum" /> {{ t.replies.length }} comentários</span>
                  <button class="rd-act" (click)="share(t.id)"><app-icon name="share" /> {{ copied() === t.id ? 'Link copiado!' : 'Compartilhar' }}</button></div>
              </div>
            </article>

            <form class="card rd-reply" (submit)="comment($event)">
              <textarea class="input" name="body" rows="3" required [placeholder]="'Comentar como ' + me() + '…'"></textarea>
              <button class="btn btn-accent">Comentar</button>
            </form>

            <div class="card rd-comments">
              @for (c of thread(); track c.i) {
                <ng-container *ngTemplateOutlet="cmt; context: { c: c, t: t }" />
                @if (c.children.length) {
                  <div class="cmt-children">
                    @for (k of c.children; track k.i) { <ng-container *ngTemplateOutlet="cmt; context: { c: k, t: t }" /> }
                  </div>
                }
              } @empty {
                <p class="empty">Nenhum comentário ainda. Seja o primeiro!</p>
              }
            </div>
          </section>

          <aside class="feed-rail">
            <div class="card rail-card">
              <h3>Sobre r/{{ t.system }}</h3>
              <p class="muted rail-text">Dúvidas, dicas e boas práticas sobre {{ t.system === 'Outros' ? 'outros assuntos' : 'o ' + t.system }}.</p>
              <small class="muted">{{ count(t.system) }} posts</small>
              <button class="btn btn-accent" (click)="dlg.showModal()"><app-icon name="plus" /> Criar post</button>
            </div>
          </aside>
        </div>
      </div>
    } @else {
      <div class="page wide dark-ui">
        <div class="page-head">
          <div><span class="eyebrow">Comunidade</span><h1>Fórum</h1><p>Perguntas, dicas e sugestões dos clientes e da equipe AIOA.</p></div>
        </div>

        <div class="feed-layout">
          <section class="feed">
            <div class="card rd-sort" role="tablist" aria-label="Ordenar posts">
              @for (s of sorts; track s.key) {
                <button role="tab" class="chip-btn" [class.on]="sort() === s.key" [attr.aria-selected]="sort() === s.key" (click)="sort.set(s.key)">
                  <app-icon [name]="s.icon" /> {{ s.label }}
                </button>
              }
              @if (community()) {
                <span class="rd-filter">r/{{ community() }} <button class="tt-x" aria-label="Limpar filtro" (click)="community.set('')"><app-icon name="x" /></button></span>
              }
            </div>

            @for (t of list(); track t.id) {
              <article class="card rd-post">
                <ng-container *ngTemplateOutlet="voteCol; context: { votes: t.votes, topic: t.id }" />
                <div class="rd-main">
                  <div class="rd-meta"><button class="rd-sub" (click)="community.set(t.system)">r/{{ t.system }}</button> · postado por u/{{ handle(t.author) }} · {{ ago(t.at) }}</div>
                  <a class="rd-link" [routerLink]="[base(), t.id]">
                    <h2 class="rd-title">{{ t.title }}</h2>
                    @if (t.body) { <p class="rd-snippet">{{ t.body }}</p> }
                  </a>
                  <div class="rd-foot">
                    <a class="rd-act" [routerLink]="[base(), t.id]"><app-icon name="forum" /> {{ t.replies.length }} comentários</a>
                    <button class="rd-act" (click)="share(t.id)"><app-icon name="share" /> {{ copied() === t.id ? 'Link copiado!' : 'Compartilhar' }}</button>
                  </div>
                </div>
              </article>
            } @empty {
              <div class="card empty">Nenhum post nesta comunidade ainda.</div>
            }
          </section>

          <aside class="feed-rail">
            <div class="card rail-card">
              <button class="btn btn-accent" (click)="dlg.showModal()"><app-icon name="plus" /> Criar post</button>
            </div>
            <div class="card rail-card">
              <h3>Comunidades</h3>
              <ul class="communities">
                <li><button [class.on]="!community()" (click)="community.set('')"><span class="cm-icon">r/</span> Todas <small>{{ store.topics().length }}</small></button></li>
                @for (s of systems; track s) {
                  <li><button [class.on]="community() === s" (click)="community.set(s)"><span class="cm-icon">{{ s[0] }}</span> r/{{ s }} <small>{{ count(s) }}</small></button></li>
                }
              </ul>
            </div>
            <div class="card rail-card">
              <h3>Regras</h3>
              <ol class="rules">
                <li>Seja cordial e respeitoso.</li>
                <li>Não compartilhe dados de clientes.</li>
                <li>Problemas urgentes viram chamado, não post.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    }

    <ng-template #voteCol let-votes="votes" let-topic="topic" let-comment="comment">
      <div class="vote-col" [class.mini]="comment != null">
        <button class="vote up" [class.on]="myVote(votes) === 1" aria-label="Votar a favor" (click)="store.vote(topic, 1, comment, me())"><app-icon name="arrow-up" /></button>
        <b class="vote-score" [class.up]="myVote(votes) === 1" [class.down]="myVote(votes) === -1">{{ score(votes) }}</b>
        <button class="vote down" [class.on]="myVote(votes) === -1" aria-label="Votar contra" (click)="store.vote(topic, -1, comment, me())"><app-icon name="arrow-down" /></button>
      </div>
    </ng-template>

    <ng-template #cmt let-c="c" let-t="t">
      <div class="cmt">
        <span class="avatar sm">{{ initials(c.author) }}</span>
        <div class="cmt-main">
          <div class="rd-meta"><strong>u/{{ handle(c.author) }}</strong> · {{ ago(c.at) }}</div>
          <p class="rd-text">{{ c.body }}</p>
          <div class="cmt-actions">
            <ng-container *ngTemplateOutlet="voteCol; context: { votes: c.votes, topic: t.id, comment: c.i }" />
            @if (c.parent == null) {
              <button class="rd-act" (click)="replyTo.set(replyTo() === c.i ? null : c.i)"><app-icon name="forum" /> Responder</button>
            }
          </div>
          @if (replyTo() === c.i) {
            <form class="cmt-reply" (submit)="comment($event, c.i)">
              <input class="input" name="body" required autocomplete="off" [placeholder]="'Responder a u/' + handle(c.author) + '…'" />
              <button class="btn btn-accent">Responder</button>
            </form>
          }
        </div>
      </div>
    </ng-template>

    <dialog #dlg>
      <form method="dialog" (submit)="create($event)">
        <div class="dialog-head"><h2>Criar post</h2>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
        </div>
        <div class="dialog-body form">
          <label class="field full">Comunidade
            <app-select name="system" label="Comunidade" [options]="communityOptions" [(value)]="newSystem" />
          </label>
          <label class="field full">Título<input class="input" name="title" required maxlength="140" /></label>
          <label class="field full">Texto<textarea class="input" name="body" rows="5"></textarea></label>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="dlg.close()">Cancelar</button>
          <button class="btn btn-primary">Publicar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Forum {
  readonly id = input<string>();
  /** Customer-portal mode (set via route data): posts as the customer, portal links. */
  readonly portal = input(false);
  protected readonly store = inject(Store);
  protected readonly base = computed(() => (this.portal() ? '/portal/forum' : '/forum'));
  protected readonly me = computed(() => (this.portal() ? this.store.portalUser()?.name : undefined) ?? this.store.user().name);
  private readonly router = inject(Router);
  protected readonly systems = SYSTEMS;
  protected readonly ago = ago;
  protected readonly initials = initials;
  protected readonly handle = handle;
  protected readonly score = score;
  protected readonly sorts: { key: Sort; label: string; icon: string }[] = [
    { key: 'hot', label: 'Em alta', icon: 'flame' },
    { key: 'new', label: 'Novos', icon: 'clock' },
    { key: 'top', label: 'Mais votados', icon: 'trending-up' },
  ];

  protected readonly sort = signal<Sort>('hot');
  protected readonly community = signal<string>('');
  protected readonly replyTo = signal<number | null>(null);
  protected readonly copied = signal<number | null>(null);
  protected readonly communityOptions = SYSTEMS.map((s) => ({ value: s, label: `r/${s}`, icon: 'forum' }));
  /** Community for a new post: the one being viewed, else the first. */
  protected readonly newSystem = linkedSignal<string>(() => this.topic()?.system ?? (this.community() || SYSTEMS[0]));

  protected readonly topic = computed(() => this.store.topics().find((t) => t.id === Number(this.id())));

  /** "Em alta" = score decayed by age, so fresh posts with votes rise (Reddit-like). */
  protected readonly list = computed(() => {
    const now = Date.now();
    const hot = (t: Topic) => (score(t.votes) + t.replies.length) / Math.pow((now - t.at) / 36e5 + 2, 1.5);
    const by: Record<Sort, (a: Topic, b: Topic) => number> = {
      hot: (a, b) => hot(b) - hot(a),
      new: (a, b) => b.at - a.at,
      top: (a, b) => score(b.votes) - score(a.votes),
    };
    return this.store
      .topics()
      .filter((t) => !this.community() || t.system === this.community())
      .sort(by[this.sort()]);
  });

  /** Top-level comments by score, each with its answers in chronological order. */
  protected readonly thread = computed(() => {
    const replies = (this.topic()?.replies ?? []).map((c, i) => ({ ...c, i }));
    return replies
      .filter((c) => c.parent == null)
      .sort((a, b) => score(b.votes) - score(a.votes) || a.at - b.at)
      .map((c) => ({ ...c, children: replies.filter((k) => k.parent === c.i).sort((a, b) => a.at - b.at) }));
  });

  protected count(system: string) {
    return this.store.topics().filter((t) => t.system === system).length;
  }

  protected myVote(votes?: Votes) {
    return votes?.[this.me()] ?? 0;
  }

  protected openCommunity(system: System) {
    this.community.set(system);
    this.router.navigate([this.base()]);
  }

  protected share(id: number) {
    void navigator.clipboard?.writeText(`${location.origin}${this.base()}/${id}`);
    this.copied.set(id);
    setTimeout(() => this.copied.set(null), 2000);
  }

  protected comment(e: Event, parent?: number) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    const t = this.topic();
    if (!t || !body) return;
    this.store.replyTopic(t.id, body, parent, this.me());
    this.replyTo.set(null);
    form.reset();
  }

  create(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    const id = this.store.createTopic(String(f.get('title')).trim(), f.get('system') as System, String(f.get('body') ?? '').trim(), this.me());
    form.reset();
    this.router.navigate([this.base(), id]);
  }
}
