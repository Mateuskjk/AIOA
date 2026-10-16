import { Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { Attachment, Message, PEOPLE, Store, ago, fmt, initials } from '../data';
import { Icon } from '../ui';
import { Attachments, ComposerTools } from '../composer';
import { Call, CallKind } from '../call';

@Component({
  selector: 'app-inbox',
  imports: [Icon, ComposerTools, Attachments, Call],
  template: `
    <div class="dm" [class.open]="current()">
      <aside class="dm-list">
        <div class="dm-list-head">
          <h1>Inbox</h1>
          <button class="icon-btn" aria-label="Nova conversa" title="Nova conversa" (click)="dlg.showModal()"><app-icon name="plus" /></button>
        </div>
        <input #q class="input" placeholder="Buscar conversas…" aria-label="Buscar conversas" (input)="query.set(q.value)" />
        <ul>
          @for (c of list(); track c.id) {
            <li>
              <button class="dm-item" [class.active]="c.id === selected()" (click)="select(c.id)">
                <span class="avatar" [class.agent]="c.org === 'Equipe AIOA'">{{ initials(c.with) }}</span>
                <span class="dm-item-text">
                  <span class="dm-row"><strong>{{ c.with }}</strong><small class="muted">{{ c.messages.length ? ago(c.messages.at(-1)!.at) : '' }}</small></span>
                  <span class="dm-row"><small class="muted dm-preview">{{ preview(c) }}</small>
                    @if (c.unread) { <em class="count">{{ c.unread }}</em> }</span>
                </span>
              </button>
            </li>
          } @empty {
            <li class="muted pad">Nenhuma conversa.</li>
          }
        </ul>
      </aside>

      <section class="dm-chat">
        @if (current(); as c) {
          <header class="dm-chat-head">
            <button class="icon-btn dm-back" aria-label="Voltar" (click)="selected.set(null)"><app-icon name="back" /></button>
            <span class="avatar" [class.agent]="c.org === 'Equipe AIOA'">{{ initials(c.with) }}</span>
            <div class="grow"><strong>{{ c.with }}</strong><br /><small class="muted">{{ c.org }}</small></div>
            <button class="icon-btn" [attr.aria-label]="'Ligar para ' + c.with" title="Ligação" (click)="call.set('audio')"><app-icon name="phone" /></button>
            <button class="icon-btn" [attr.aria-label]="'Chamada de vídeo com ' + c.with" title="Chamada de vídeo" (click)="call.set('video')"><app-icon name="video" /></button>
          </header>
          @if (call(); as k) {
            <app-call [kind]="k" [peer]="c.with" [me]="me()" [context]="c.org" (ended)="endCall(c.id, k, $event)" />
          }
          <div #thread class="dm-thread">
            @for (m of c.messages; track $index) {
              <div class="bubble" [class.mine]="m.author === me()">
                @if (m.files?.length) { <app-attachments [files]="m.files!" /> }
                @if (m.body) { <p>{{ m.body }}</p> }
                <small>{{ fmt(m.at) }}</small>
              </div>
            } @empty {
              <p class="empty">Diga olá para {{ c.with }} 👋</p>
            }
          </div>
          @if (files().length) {
            <app-attachments class="dm-pending" [(files)]="files" removable />
          }
          <form class="dm-composer" (submit)="send(c.id, $event)">
            <app-composer-tools [target]="msg" [(files)]="files" />
            <input #msg class="input" name="body" autocomplete="off" [placeholder]="'Mensagem para ' + c.with + '…'" />
            <button class="btn btn-primary" aria-label="Enviar"><app-icon name="send" /></button>
          </form>
        } @else {
          <div class="empty dm-placeholder">
            <app-icon name="inbox" />
            <p>Conversas diretas com a equipe e com os clientes, fora dos tickets.<br />Selecione uma conversa ou comece uma nova.</p>
          </div>
        }
      </section>
    </div>

    <dialog #dlg>
      <div class="dialog-head"><h2>Nova conversa</h2>
        <button type="button" class="icon-btn" aria-label="Fechar" (click)="dlg.close()"><app-icon name="x" /></button>
      </div>
      <ul class="list">
        @for (p of people(); track p.name) {
          <li class="clickable" (click)="start(p.name, p.org); dlg.close()">
            <span class="avatar sm" [class.agent]="p.org === 'Equipe AIOA'">{{ initials(p.name) }}</span>
            <div class="grow"><strong>{{ p.name }}</strong><br /><small class="muted">{{ p.org }}</small></div>
          </li>
        }
      </ul>
    </dialog>
  `,
})
export class Inbox {
  private readonly store = inject(Store);
  protected readonly ago = ago;
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly me = computed(() => this.store.user().name);
  protected readonly people = computed(() => PEOPLE.filter((p) => p.name !== this.me()));

  protected readonly query = signal('');
  protected readonly files = signal<Attachment[]>([]);
  protected readonly call = signal<CallKind | null>(null);
  protected readonly selected = signal<number | null>(null);
  protected readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store.conversations().filter((c) => !q || `${c.with} ${c.org}`.toLowerCase().includes(q));
  });
  protected readonly current = computed(() => this.store.conversations().find((c) => c.id === this.selected()));

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    // Keep the newest message in view whenever the open thread changes.
    afterRenderEffect(() => {
      this.current();
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected preview(c: { messages: Message[] }) {
    const m = c.messages.at(-1);
    if (!m) return 'Nova conversa';
    const f = m.files?.[0];
    const body = m.body || (f?.type.startsWith('audio/') ? '🎤 Áudio' : f?.type.startsWith('image/') ? '🖼️ Imagem' : '📎 Anexo');
    return (m.author === this.me() ? 'Você: ' : '') + body;
  }

  protected select(id: number) {
    this.selected.set(id);
    this.store.readDm(id);
  }

  protected start(name: string, org: string) {
    this.select(this.store.startDm(name, org));
  }

  /** Records the finished call in the thread so both sides see it happened. */
  protected endCall(id: number, kind: CallKind, secs: number) {
    this.call.set(null);
    const what = kind === 'video' ? '📹 Chamada de vídeo' : '📞 Ligação';
    this.store.sendDm(id, `${what} · ${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s`);
  }

  protected send(id: number, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (body || this.files().length) this.store.sendDm(id, body, this.files());
    this.files.set([]);
    form.reset();
  }
}
