import { Component, inject, signal } from '@angular/core';
import { Backend } from './backend';
import { Logo } from './ui';

/** Google sends the widget's login popup here; the session goes back to the widget and the popup closes. */
@Component({
  selector: 'app-embed-callback',
  imports: [Logo],
  template: `
    <div class="em-callback">
      <app-logo />
      <p>{{ text() }}</p>
    </div>
  `,
})
export class EmbedCallback {
  private readonly backend = inject(Backend);
  protected readonly text = signal('Conectando sua conta…');

  constructor() {
    void (async () => {
      await this.backend.whenReady(); // supabase-js reads the session from the URL
      const s = await this.backend.currentSession();
      if (s && opener) {
        opener.postMessage({ type: 'aioa:session', access_token: s.access_token, refresh_token: s.refresh_token }, location.origin);
        this.text.set('Pronto! Pode voltar ao assistente.');
        setTimeout(() => close(), 400);
      } else this.text.set(s ? 'Conectado. Pode fechar esta janela.' : 'Não foi possível entrar. Feche esta janela e tente de novo.');
    })();
  }
}
