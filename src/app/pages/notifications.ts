import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Notice, Store, ago } from '../data';

@Component({
  selector: 'app-notifications',
  template: `
    <div class="page">
      <div class="page-head">
        <div><span class="eyebrow">Atividade</span><h1>Notificações</h1><p>{{ store.unread() }} não lidas</p></div>
        <button class="btn" (click)="store.markRead()" [disabled]="!store.unread()">Marcar todas como lidas</button>
      </div>
      <div class="card">
        <ul class="list">
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
  private readonly router = inject(Router);
  protected readonly ago = ago;

  open(n: Notice) {
    this.store.markRead(n.id);
    this.router.navigate(['/tickets', n.ticketId]);
  }
}
