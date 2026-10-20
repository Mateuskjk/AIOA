import { Component, ElementRef, afterRenderEffect, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AGENTS, Attachment, CHANNELS, Channel, STATUSES, Status, Store, Ticket, badge, code, fmt, initials, sla } from '../data';
import { Icon } from '../ui';
import { Attachments, ComposerTools } from '../composer';
import { TicketSide } from './ticket-side';
import { Call, CallKind } from '../call';

@Component({
  selector: 'app-ticket-detail',
  host: { '(document:click)': 'closeVia($event)' },
  imports: [Icon, RouterLink, ComposerTools, Attachments, TicketSide, Call],
  template: `
    @if (ticket(); as t) {
      <div class="td dark-ui">
        <header class="td-top">
          <a routerLink="/tickets" class="back"><app-icon name="back" /> Lista de tickets</a>
          <div class="td-title">
            <button class="icon-btn" aria-label="Chamado anterior" [disabled]="!sibling(-1)" (click)="go(sibling(-1))"><app-icon name="chevron-left" /></button>
            <button class="icon-btn" aria-label="Próximo chamado" [disabled]="!sibling(1)" (click)="go(sibling(1))"><app-icon name="chevron-right" /></button>
            <b class="code">{{ code(t) }}</b>
            <span class="title-chip" [title]="t.title">{{ t.title }}</span>
            <span [class]="badge(t.status)">{{ t.status }}</span>
            <button class="icon-btn" aria-label="Ligar para o cliente" title="Ligação" (click)="call.set('audio')"><app-icon name="phone" /></button>
            <button class="icon-btn" aria-label="Chamada de vídeo com o cliente" title="Chamada de vídeo" (click)="call.set('video')"><app-icon name="video" /></button>
          </div>
          <div class="split">
            <button class="btn btn-ok" (click)="resolve(t)" [disabled]="t.status === 'Resolvido'">Marcar como resolvido</button>
            <button class="btn btn-ok caret" aria-label="Outros status" (click)="menu.set(!menu())"><app-icon name="chevron-down" /></button>
            @if (menu()) {
              <div class="menu" role="menu">
                @for (s of statuses; track s) {
                  <button role="menuitem" (click)="setStatus(t, s)" [class.current]="s === t.status"><span [class]="badge(s)">{{ s }}</span></button>
                }
              </div>
            }
          </div>
        </header>

        <div class="td-body">
          <section class="td-main">
            <div #scroller class="td-scroll">
              <!-- Chat: customer on the left, the team on the right, internal notes in amber, events as centered pills. -->
              <ol class="td-chat">
                @for (item of timeline(); track $index) {
                  @if (item.kind === 'event') {
                    <li class="tc-event"><span><app-icon name="ticket" /> {{ item.text }} <small>· {{ fmt(item.at) }}</small></span></li>
                  } @else {
                    <li class="tc-msg" [class.mine]="isAgent(item.author)" [class.note]="item.internal">
                      <span class="avatar sm" [class.agent]="isAgent(item.author)">{{ initials(item.author) }}</span>
                      <div class="tc-bubble">
                        <header><strong>{{ item.author }}</strong>
                          @if (item.internal) { <span class="note-tag"><app-icon name="lock" /> Nota interna</span> }
                          @else if (item.via) { <span class="via">{{ item.via }}</span> }
                        </header>
                        @if (item.body) { <p>{{ item.body }}</p> }
                        @if (item.files?.length) { <app-attachments [files]="item.files!" /> }
                        <small class="tc-time">{{ fmt(item.at) }}</small>
                      </div>
                    </li>
                  }
                }
              </ol>
            </div>

              <form class="composer" (submit)="send(t, $event)">
                <span class="avatar sm agent">{{ initials(store.user().name) }}</span>
                <div class="box" [class.internal]="note()">
                  <div class="cmp-top">
                    <div class="seg view-toggle" role="radiogroup" aria-label="Tipo de mensagem">
                      <button type="button" role="radio" [attr.aria-checked]="!note()" [class.on]="!note()" (click)="note.set(false)">Resposta</button>
                      <button type="button" role="radio" [attr.aria-checked]="note()" [class.on]="note()" (click)="note.set(true)"><app-icon name="lock" /> Nota interna</button>
                    </div>
                    @if (note()) {
                      <span class="muted">Visível só para a equipe AIOA</span>
                    } @else {
                      <span class="via-label">Via</span>
                      <div class="via-wrap">
                        <button type="button" class="via-pick" [attr.aria-expanded]="viaOpen()" aria-haspopup="listbox" (click)="viaOpen.set(!viaOpen())">
                          <app-icon [name]="channelInfo[via()].icon" /> {{ via() }} <app-icon name="chevron-down" />
                        </button>
                        @if (viaOpen()) {
                          <ul class="via-menu" role="listbox" aria-label="Canal da resposta">
                            @for (c of channels; track c) {
                              <li><button type="button" role="option" [attr.aria-selected]="c === via()" [class.on]="c === via()" (click)="via.set(c); viaOpen.set(false)">
                                <app-icon [name]="channelInfo[c].icon" />
                                <span><strong>{{ c }}</strong><small>{{ channelInfo[c].hint }}</small></span>
                                @if (c === via()) { <app-icon name="check" /> }
                              </button></li>
                            }
                          </ul>
                        }
                      </div>
                      <label>De <span class="chip">Suporte AIOA</span></label>
                    }
                  </div>
                  @if (files().length) {
                    <app-attachments [(files)]="files" removable />
                  }
                  <textarea #ta name="body" rows="2" (keydown.control.enter)="submit($event)"
                    [placeholder]="(note() ? 'Escreva uma nota interna para a equipe…' : 'Escreva uma resposta para ' + t.requester + '…') + ' Cole prints com Ctrl+V.'"></textarea>
                  <div class="cmp-foot">
                    <app-composer-tools [target]="ta" [(files)]="files" />
                    <button class="btn btn-accent" title="Ctrl + Enter"><app-icon name="send" /> {{ note() ? 'Salvar nota' : 'Enviar' }}</button>
                  </div>
                </div>
              </form>
          </section>

          <app-ticket-side [t]="t" (insert)="insertText($event)" />
        </div>
      </div>
      @if (call(); as k) {
        <app-call [kind]="k" [peer]="t.requester" [me]="store.user().name" [context]="code(t) + ' · ' + t.title" (ended)="endCall(t, k, $event)" />
      }
    } @else {
      <div class="page"><div class="empty">Chamado não encontrado. <a routerLink="/tickets">Voltar à lista</a></div></div>
    }
  `,
})
export class TicketDetail {
  readonly id = input.required<string>();
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly statuses = STATUSES;
  /** Channels the team can reply through (WhatsApp replies aren't sent from here). */
  protected readonly channels = CHANNELS.filter((c) => c !== 'WhatsApp');
  protected readonly channelInfo: Record<string, { icon: string; hint: string }> = {
    'E-mail': { icon: 'mail', hint: 'Envia por e-mail ao solicitante' },
    Portal: { icon: 'globe', hint: 'Aparece no portal do cliente' },
  };
  protected readonly viaOpen = signal(false);

  protected closeVia(e: Event) {
    if (this.viaOpen() && !(e.target as Element).closest('.via-wrap')) this.viaOpen.set(false);
  }
  protected readonly badge = badge;
  protected readonly code = code;
  protected readonly fmt = fmt;
  protected readonly initials = initials;
  protected readonly sla = sla;
  protected readonly menu = signal(false);
  protected readonly call = signal<CallKind | null>(null);
  protected readonly files = signal<Attachment[]>([]);
  private readonly reply = viewChild<ElementRef<HTMLTextAreaElement>>('ta');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Keep the newest message in view when the thread opens or grows.
    afterRenderEffect(() => {
      this.timeline().length;
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
  protected readonly via = linkedSignal<Channel>(() => {
    const first = this.ticket()?.messages[0]?.via;
    return first && first !== 'WhatsApp' ? first : 'E-mail';
  });

  protected readonly ticket = computed(() => this.store.ticket(Number(this.id())));
  /** Composer mode: internal note (team only) instead of a reply to the customer. */
  protected readonly note = signal(false);
  protected readonly timeline = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      ...t.log.map((l) => ({ kind: 'event' as const, ...l, author: '', body: '', via: undefined, files: undefined })),
      ...t.messages.map((m) => ({ kind: 'msg' as const, text: '', ...m })),
    ].sort((a, b) => a.at - b.at);
  });

  /** Appends text from the side panels to the reply box. */
  protected insertText(text: string) {
    const el = this.reply()?.nativeElement;
    if (!el) return;
    el.value = el.value.trim() ? el.value.trimEnd() + '\n\n' + text : text;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  protected endCall(t: Ticket, kind: CallKind, secs: number) {
    this.call.set(null);
    const what = kind === 'video' ? 'uma chamada de vídeo' : 'uma ligação';
    const dur = `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s`;
    this.store.logEvent(t.id, `${this.store.user().name} fez ${what} com ${t.requester} · duração ${dur}`);
  }

  protected isAgent(name: string) {
    return AGENTS.includes(name) || name === this.store.user().name;
  }

  protected sibling(dir: 1 | -1) {
    const ids = this.store.tickets().map((t) => t.id).sort((a, b) => a - b);
    return ids[ids.indexOf(Number(this.id())) + dir];
  }

  protected go(id?: number) {
    if (id) this.router.navigate(['/tickets', id]);
  }

  protected setStatus(t: Ticket, status: Status) {
    this.menu.set(false);
    this.store.updateTicket(t.id, { status });
  }

  protected submit(e: Event) {
    e.preventDefault();
    (e.target as HTMLTextAreaElement).form?.requestSubmit();
  }

  protected send(t: Ticket, e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body && !this.files().length) return;
    this.store.reply(t.id, body, this.via(), this.note(), this.files());
    this.files.set([]);
    (form.elements.namedItem('body') as HTMLTextAreaElement).value = '';
  }

  /** Resolves through the shared Store flow (closing message + transcript), then returns to the list. */
  protected resolve(t: Ticket) {
    this.menu.set(false);
    this.store.resolve(t.id, this.via());
    this.router.navigate(['/tickets']);
  }
}
