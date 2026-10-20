import { Injectable, signal } from '@angular/core';

type Permission = NotificationPermission | 'unsupported';

/**
 * Alerts for new system notifications: a short synthesized chime (Web Audio, no audio file)
 * and a native browser notification.
 * ponytail: page-level Notification API only; real push (site closed) needs a service worker + push server.
 */
@Injectable({ providedIn: 'root' })
export class Notifier {
  readonly permission = signal<Permission>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  private ctx?: AudioContext;

  constructor() {
    if (typeof document === 'undefined') return;
    // Browsers only allow audio after a user gesture: create/resume the context on the first one.
    const unlock = () => {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  /** Two-note "ding" (A5 -> E6), about 0.4 s. Silent until the page has had a user gesture. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.12;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  /** Asks the browser for permission to show notifications (must run from a click). */
  async enable() {
    if (typeof Notification === 'undefined') return;
    this.permission.set(await Notification.requestPermission());
  }

  /** Native notification; clicking it focuses the app and runs `onClick`. */
  push(body: string, onClick?: () => void) {
    if (this.permission() !== 'granted') return;
    const n = new Notification('AIOA', { body, icon: '/favicon.svg', tag: `aioa-${Date.now()}` });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  }
}
