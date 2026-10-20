import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Notice, Store, ago } from '../data';
import { Notifier } from '../notifier';
import { Icon } from '../ui';

@Component({
  selector: 'app-notifications',
  imports: [Icon],
  template: `
    <div class="page wide dark-ui">
      <div class="page-head">
        <div><span class="eyebrow">Atividade</span><h1>Notificações</h1><p>{{ store.unread() }} não lidas</p></div>
        <div class="toolbar">
          @switch (notifier.permission()) {
            @case ('granted') { <span class="nt-status"><app-icon name="bell" /> Notificações do navegador ativas</span> }
            @case ('denied') { <span class="nt-status off" title="Libere nas configurações do site, no navegador"><app-icon name="bell" /> Bloqueadas no navegador</span> }
            @case ('unsupported') { }
            @default { <button class="btn" (click)="notifier.enable()"><app-icon name="bell" /> Ativar notificações do navegador</button> }
          }
          <button class="btn" (click)="test()" title="Toca o som e mostra uma notificação de exemplo"><app-icon name="mic" /> Testar som</button>
          <button class="btn btn-accent" (click)="store.markRead()" [disabled]="!store.unread()">Marcar todas como lidas</button>
        </div>
      </div>
      <div class="card">
        <ul class="list nt-list">
          @for (n of store.notices(); track n.id) {
            <li class="clickable" [class.unread]="!n.read" (click)="open(n)">
              <i class="unread-dot" [style.visibility]="n.read ? 'hidden' : 'visible'"></i>
              <div class="grow">
                <span [style.font-weight]="n.read ? 400 : 600">{{ n.text }}</span><br />
                <small class="muted">{{ ago(n.at) }}</small>
              </div>
            </li>
          } @empty {
            <li class="empty">Tudo em dia por aqui.</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class Notifications {
  protected readonly store = inject(Store);
  protected readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  protected readonly ago = ago;

  open(n: Notice) {
    this.store.markRead(n.id);
    this.router.navigate(['/tickets', n.ticketId]);
  }

  test() {
    this.notifier.chime();
    this.notifier.push('Exemplo: novo chamado aberto por Nicolas Gomes');
  }
}
