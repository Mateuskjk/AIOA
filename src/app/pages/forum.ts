import { Component, computed, inject, signal } from '@angular/core';
import { SYSTEMS, Store, System, ago, initials } from '../data';
import { Icon } from '../ui';

@Component({
  selector: 'app-forum',
  imports: [Icon],
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Comunidade</span><h1>Fórum</h1><p>Dúvidas, dicas e boas práticas sobre os sistemas Lex.</p></div>
        <button class="btn btn-primary" (click)="dlg.showModal()"><app-icon name="plus" /> Novo tópico</button>
      </div>

      <div class="toolbar">
        <button class="btn" [class.on]="!system()" (click)="system.set('')">Todos</button>
        @for (s of systems; track s) {
          <button class="btn" [class.on]="system() === s" (click)="system.set(s)">{{ s }}</button>
        }
      </div>

      <div class="card">
        <ul class="list">
          @for (t of topics(); track t.id) {
            <li class="topic">
              <button class="topic-head" (click)="openId.set(openId() === t.id ? null : t.id)" [attr.aria-expanded]="openId() === t.id">
                <span class="avatar sm">{{ initials(t.author) }}</span>
                <span class="grow"><strong>{{ t.title }}</strong><br />
                  <small class="muted">{{ t.author }} · {{ ago(t.at) }} · <span class="badge">{{ t.system }}</span></small></span>
                <small class="muted replies"><app-icon name="forum" /> {{ t.replies.length }}</small>
              </button>
              @if (openId() === t.id) {
                <ol class="timeline topic-body">
                  @for (r of t.replies; track $index) {
                    <li class="msg"><span class="avatar sm">{{ initials(r.author) }}</span>
                      <div><header><strong>{{ r.author }}</strong><small class="muted">· {{ ago(r.at) }}</small></header><p>{{ r.body }}</p></div>
                    </li>
                  }
                  <li>
                    <form class="toolbar" (submit)="reply(t.id, $event)">
                      <input class="input grow" name="body" placeholder="Responder…" required />
                      <button class="btn btn-primary">Responder</button>
                    </form>
                  </li>
                </ol>
              }
            </li>
          } @empty {
            <li class="empty">Nenhum tópico ainda.</li>
          }
        </ul>
      </div>
    </div>

    <dialog #dlg>
      <form method="dialog" (submit)="create($event)">
        <div class="dialog-head"><h2>Novo tópico</h2>
          <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
        </div>
        <div class="dialog-body form">
          <label class="field full">Título<input class="input" name="title" required /></label>
          <label class="field full">Sistema
            <select class="input" name="system">@for (s of systems; track s) { <option>{{ s }}</option> }</select>
          </label>
          <label class="field full">Mensagem<textarea class="input" name="body" rows="4"></textarea></label>
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
  protected readonly store = inject(Store);
  protected readonly systems = SYSTEMS;
  protected readonly ago = ago;
  protected readonly initials = initials;
  protected readonly system = signal('');
  protected readonly openId = signal<number | null>(null);
  protected readonly topics = computed(() => this.store.topics().filter((t) => !this.system() || t.system === this.system()));

  create(e: Event) {
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    this.store.createTopic(String(f.get('title')).trim(), f.get('system') as System, String(f.get('body') ?? '').trim());
    form.reset();
  }

  reply(id: number, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    this.store.replyTopic(id, String(new FormData(form).get('body')).trim());
    form.reset();
  }
}
