import { Component, DestroyRef, ElementRef, booleanAttribute, inject, input, model, signal, viewChild } from '@angular/core';
import { Attachment } from './data';
import { Icon } from './ui';

const MAX_BYTES = 2 * 1024 * 1024; // keeps localStorage (the prototype's backend) from filling up
const EMOJIS = [
  '😀', '😁', '😂', '😊', '😉', '😍', '🤔', '😅', '😢', '😡', '😴', '🤝',
  '👍', '👎', '👏', '🙏', '💪', '👋', '✅', '❌', '⚠️', '🚀', '🔥', '🎉',
  '💡', '📌', '📎', '📅', '⏰', '🐛', '🔧', '❤️',
];

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Attach / emoji / voice-note buttons for a message composer. */
@Component({
  selector: 'app-composer-tools',
  imports: [Icon],
  host: { class: 'tools', '(document:click)': 'outside($event)' },
  template: `
    @if (recording()) {
      <span class="rec"><i class="rec-dot"></i> Gravando {{ clock(elapsed()) }}</span>
      <button type="button" class="icon-btn" aria-label="Descartar áudio" title="Descartar" (click)="stop(false)"><app-icon name="trash" /></button>
      <button type="button" class="icon-btn rec-ok" aria-label="Concluir áudio" title="Concluir" (click)="stop(true)"><app-icon name="check" /></button>
    } @else {
      <button type="button" class="icon-btn" aria-label="Anexar arquivo" title="Anexar arquivo" (click)="file.click()"><app-icon name="paperclip" /></button>
      <input #file type="file" multiple hidden (change)="pick(file)" />
      <span class="emoji-wrap">
        <button type="button" class="icon-btn" aria-label="Inserir emoji" title="Emoji" [attr.aria-expanded]="emojiOpen()"
          (click)="emojiOpen.set(!emojiOpen())"><app-icon name="smile" /></button>
        @if (emojiOpen()) {
          <div class="emoji-pop">
            @for (e of emojis; track e) { <button type="button" (click)="insert(e)">{{ e }}</button> }
          </div>
        }
      </span>
      <button type="button" class="icon-btn" aria-label="Gravar áudio" title="Gravar áudio" (click)="record()"><app-icon name="mic" /></button>
    }
  `,
})
export class ComposerTools {
  /** Text field that receives emojis at the caret. */
  readonly target = input.required<HTMLTextAreaElement | HTMLInputElement>();
  readonly files = model<Attachment[]>([]);

  protected readonly emojis = EMOJIS;
  protected readonly clock = clock;
  protected readonly emojiOpen = signal(false);
  protected readonly recording = signal(false);
  protected readonly elapsed = signal(0);

  private readonly host = inject(ElementRef<HTMLElement>);
  private recorder?: MediaRecorder;
  private keep = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop(false));
  }

  protected outside(e: Event) {
    if (this.emojiOpen() && !this.host.nativeElement.contains(e.target as Node)) this.emojiOpen.set(false);
  }

  protected insert(emoji: string) {
    const el = this.target();
    const at = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, at) + emoji + el.value.slice(el.selectionEnd ?? at);
    el.focus();
    el.setSelectionRange(at + emoji.length, at + emoji.length);
    this.emojiOpen.set(false);
  }

  protected async pick(input: HTMLInputElement) {
    for (const f of Array.from(input.files ?? [])) {
      if (f.size > MAX_BYTES) {
        alert(`"${f.name}" tem ${size(f.size)}. O limite no protótipo é ${size(MAX_BYTES)} por arquivo.`);
        continue;
      }
      this.add({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, url: await toDataUrl(f) });
    }
    input.value = '';
  }

  protected async record() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    const started = Date.now();
    const timer = setInterval(() => this.elapsed.set((Date.now() - started) / 1000), 250);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      this.recording.set(false);
      if (!this.keep || !chunks.length) return;
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      this.add({ name: `Áudio ${clock((Date.now() - started) / 1000)}`, type: blob.type, size: blob.size, url: await toDataUrl(blob) });
    };
    this.elapsed.set(0);
    this.recording.set(true);
    this.recorder = rec;
    rec.start();
  }

  protected stop(keep: boolean) {
    this.keep = keep;
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  private add(a: Attachment) {
    this.files.update((f) => [...f, a]);
  }
}

/** Renders attachments: images as thumbnails (click to preview), audio as a player, anything else as a download chip. */
@Component({
  selector: 'app-attachments',
  imports: [Icon],
  host: { class: 'atts' },
  template: `
    @for (f of files(); track $index) {
      <div class="att">
        @if (f.type.startsWith('audio/')) {
          <audio controls preload="metadata" [src]="f.url"></audio>
        } @else if (f.type.startsWith('image/')) {
          <button type="button" class="att-img" [title]="'Visualizar ' + f.name" (click)="open(f)"><img [src]="f.url" [alt]="f.name" /></button>
        } @else {
          <a class="att-file" [href]="f.url" [download]="f.name"><app-icon name="paperclip" /><span>{{ f.name }}</span><small>{{ size(f.size) }}</small></a>
        }
        @if (removable()) {
          <button type="button" class="att-x" [attr.aria-label]="'Remover ' + f.name" (click)="drop($index)"><app-icon name="x" /></button>
        }
      </div>
    }

    <dialog #viewer class="lightbox" (close)="preview.set(null)" (click)="backdrop($event)">
      @if (preview(); as p) {
        <header class="lightbox-bar">
          <span class="lightbox-name">{{ p.name }} <small>{{ size(p.size) }}</small></span>
          <a class="btn btn-sm" [href]="p.url" [download]="p.name"><app-icon name="download" /> Baixar</a>
          <button type="button" class="icon-btn" aria-label="Fechar visualização" (click)="viewer.close()"><app-icon name="x" /></button>
        </header>
        <img class="lightbox-img" [src]="p.url" [alt]="p.name" />
      }
    </dialog>
  `,
})
export class Attachments {
  readonly files = model.required<Attachment[]>();
  readonly removable = input(false, { transform: booleanAttribute });
  protected readonly size = size;
  protected readonly preview = signal<Attachment | null>(null);
  private readonly viewer = viewChild.required<ElementRef<HTMLDialogElement>>('viewer');

  protected open(f: Attachment) {
    this.preview.set(f);
    this.viewer().nativeElement.showModal();
  }

  /** Clicking the dimmed area around the image closes the preview. */
  protected backdrop(e: MouseEvent) {
    if (e.target === this.viewer().nativeElement) this.viewer().nativeElement.close();
  }

  protected drop(i: number) {
    this.files.update((f) => f.filter((_, j) => j !== i));
  }
}
