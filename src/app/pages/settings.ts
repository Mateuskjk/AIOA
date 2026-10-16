import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../data';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  template: `
    <div class="page narrow">
      <div class="page-head"><div><span class="eyebrow">Conta</span><h1>Configurações</h1></div></div>
      <form class="card card-body form" (submit)="save($event)">
        <label class="field">Nome<input class="input" name="name" [value]="store.user().name" required /></label>
        <label class="field">Cargo<input class="input" name="role" [value]="store.user().role" /></label>
        <div class="full toolbar">
          <button class="btn btn-primary">Salvar</button>
          @if (saved()) { <span class="muted">Salvo!</span> }
        </div>
      </form>
      <div class="card card-body">
        <h2>Portal do cliente</h2>
        <p class="muted">Veja o AIOA como uma das empresas clientes: abrir chamados, acompanhar e responder.</p>
        <a class="btn" routerLink="/portal/login">Abrir portal do cliente</a>
      </div>
      <div class="card card-body">
        <h2>Dados de demonstração</h2>
        <p class="muted">Este protótipo guarda os dados no navegador. Restaure o estado inicial a qualquer momento.</p>
        <button class="btn btn-danger" (click)="reset()">Restaurar dados de exemplo</button>
      </div>
    </div>
  `,
})
export class Settings {
  protected readonly store = inject(Store);
  protected readonly saved = signal(false);

  save(e: Event) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    this.store.setUser({ name: String(f.get('name')).trim(), role: String(f.get('role')).trim() });
    this.saved.set(true);
  }

  reset() {
    if (confirm('Restaurar os dados de exemplo? As alterações feitas serão perdidas.')) this.store.reset();
  }
}
