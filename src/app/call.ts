import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { initials } from './data';
import { Icon } from './ui';

export type CallKind = 'audio' | 'video';
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Full-screen voice/video call with the agent's own camera, mic and screen share.
 * ponytail: local media only; joining the customer needs a WebRTC signaling/SFU service (e.g. LiveKit) with the real backend.
 */
@Component({
  selector: 'app-call',
  imports: [Icon],
  host: { class: 'call', role: 'dialog', 'aria-modal': 'true', '[attr.aria-label]': 'title()', '(document:keydown.escape)': 'end()' },
  template: `
    <header class="call-top">
      <div><strong>{{ title() }}</strong><small>{{ context() }}</small></div>
      <span class="call-time">{{ clock(elapsed()) }}</span>
    </header>

    <div class="call-stage">
      @if (error()) {
        <div class="call-peer">
          <span class="call-avatar"><app-icon name="alert" /></span>
          <p>{{ error() }}</p>
        </div>
      } @else if (screen()) {
        <video class="call-screen" [srcObject]="screen()" autoplay playsinline muted></video>
      } @else {
        <div class="call-peer">
          <span class="call-avatar ring">{{ initials(peer()) }}</span>
          <strong>{{ peer() }}</strong>
          <p>Aguardando {{ peer() }} entrar na chamada…</p>
        </div>
      }

      @if (kind() === 'video' && stream() && !error()) {
        <div class="call-self" [class.off]="camOff()">
          <video [srcObject]="stream()" autoplay playsinline muted></video>
          @if (camOff()) { <span class="call-avatar sm">{{ initials(me()) }}</span> }
          <small>Você</small>
        </div>
      }
    </div>

    <nav class="call-controls" aria-label="Controles da chamada">
      <button class="call-btn" [class.off]="muted()" [attr.aria-pressed]="muted()" [attr.aria-label]="muted() ? 'Ativar microfone' : 'Desativar microfone'"
        [title]="muted() ? 'Ativar microfone' : 'Desativar microfone'" (click)="toggleMic()" [disabled]="!stream()">
        <app-icon [name]="muted() ? 'mic-off' : 'mic'" />
      </button>
      @if (kind() === 'video') {
        <button class="call-btn" [class.off]="camOff()" [attr.aria-pressed]="camOff()" [attr.aria-label]="camOff() ? 'Ligar câmera' : 'Desligar câmera'"
          [title]="camOff() ? 'Ligar câmera' : 'Desligar câmera'" (click)="toggleCam()" [disabled]="!stream()">
          <app-icon [name]="camOff() ? 'video-off' : 'video'" />
        </button>
        <button class="call-btn" [class.on]="screen()" [attr.aria-pressed]="!!screen()" aria-label="Compartilhar tela" title="Compartilhar tela" (click)="toggleScreen()">
          <app-icon name="monitor-up" />
        </button>
      }
      <button class="call-btn end" aria-label="Encerrar chamada" title="Encerrar chamada" (click)="end()"><app-icon name="phone" /></button>
    </nav>
  `,
})
export class Call implements OnInit {
  readonly kind = input.required<CallKind>();
  readonly peer = input.required<string>();
  readonly me = input.required<string>();
  readonly context = input('');
  /** Emits the call duration in seconds when the call ends. */
  readonly ended = output<number>();

  protected readonly clock = clock;
  protected readonly initials = initials;
  protected readonly stream = signal<MediaStream | null>(null);
  protected readonly screen = signal<MediaStream | null>(null);
  protected readonly error = signal('');
  protected readonly muted = signal(false);
  protected readonly camOff = signal(false);
  protected readonly elapsed = signal(0);

  protected readonly title = computed(() => `${this.kind() === 'video' ? 'Chamada de vídeo' : 'Ligação'} com ${this.peer()}`);

  private readonly started = Date.now();
  private readonly timer = setInterval(() => this.elapsed.set((Date.now() - this.started) / 1000), 500);
  private done = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopAll());
  }

  // Inputs (kind) are only available from ngOnInit on.
  async ngOnInit() {
    try {
      this.stream.set(await navigator.mediaDevices.getUserMedia({ audio: true, video: this.kind() === 'video' }));
    } catch {
      this.error.set(
        this.kind() === 'video'
          ? 'Não foi possível acessar a câmera ou o microfone. Verifique a permissão do navegador.'
          : 'Não foi possível acessar o microfone. Verifique a permissão do navegador.',
      );
    }
  }

  protected toggleMic() {
    this.muted.update((m) => !m);
    this.stream()?.getAudioTracks().forEach((t) => (t.enabled = !this.muted()));
  }

  protected toggleCam() {
    this.camOff.update((c) => !c);
    this.stream()?.getVideoTracks().forEach((t) => (t.enabled = !this.camOff()));
  }

  protected async toggleScreen() {
    if (this.screen()) return this.stopScreen();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getVideoTracks()[0].onended = () => this.stopScreen();
      this.screen.set(s);
    } catch {
      // user cancelled the browser's share picker
    }
  }

  private stopScreen() {
    this.screen()?.getTracks().forEach((t) => t.stop());
    this.screen.set(null);
  }

  protected end() {
    if (this.done) return;
    this.done = true;
    this.stopAll();
    this.ended.emit(Math.round((Date.now() - this.started) / 1000));
  }

  private stopAll() {
    clearInterval(this.timer);
    this.stream()?.getTracks().forEach((t) => t.stop());
    this.stopScreen();
  }
}
