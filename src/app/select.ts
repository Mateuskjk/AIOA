import { Component, ElementRef, inject, input, model, signal } from '@angular/core';
import { Icon } from './ui';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  icon?: string;
}

/** ["LexFlow", …] → options whose value and label are the same text. */
export const toOptions = (xs: readonly string[], icon?: string): SelectOption[] => xs.map((x) => ({ value: x, label: x, icon }));

/** Dark dropdown that replaces a native <select> where the OS popup can't be styled. Keyboard: arrows, Enter, Esc. */
@Component({
  selector: 'app-select',
  imports: [Icon],
  host: { class: 'dd', '(document:click)': 'outside($event)', '(keydown)': 'key($event)' },
  template: `
    @if (name()) { <input type="hidden" [name]="name()" [attr.value]="value()" /> }
    <button type="button" class="input dd-btn" [attr.aria-label]="label()" aria-haspopup="listbox" [attr.aria-expanded]="open()" (click)="toggle()">
      @if (current()?.icon; as i) { <app-icon class="dd-lead" [name]="i" /> }
      <span>{{ current()?.label ?? placeholder() }}</span>
      <app-icon class="dd-caret" name="chevron-down" />
    </button>
    @if (open()) {
      <ul class="dd-menu" [class.up]="up()" [style.max-height.px]="maxHeight()" role="listbox" [attr.aria-label]="label()">
        @for (o of options(); track o.value; let i = $index) {
          <li>
            <button type="button" role="option" [attr.aria-selected]="o.value === value()" [class.on]="o.value === value()" [class.active]="i === cursor()"
              (click)="pick(o.value)" (mouseenter)="cursor.set(i)">
              @if (o.icon) { <app-icon class="dd-lead" [name]="o.icon" /> }
              <span><strong>{{ o.label }}</strong>@if (o.hint) { <small>{{ o.hint }}</small> }</span>
              @if (o.value === value()) { <app-icon class="dd-check" name="check" /> }
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class Select {
  readonly options = input.required<SelectOption[]>();
  readonly value = model('');
  readonly label = input('');
  readonly placeholder = input('Selecione…');
  /** Form field name: the value is submitted through a hidden input, like a native select. */
  readonly name = input('');

  protected readonly open = signal(false);
  protected readonly cursor = signal(0);
  /** Opens upward when there isn't room below (e.g. near the bottom of a dialog). */
  protected readonly up = signal(false);
  /** Menu height capped to the room on the chosen side, so a dialog never cuts it. */
  protected readonly maxHeight = signal(300);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected current() {
    return this.options().find((o) => o.value === this.value());
  }

  protected toggle() {
    this.cursor.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
    const el: HTMLElement = this.host.nativeElement;
    const box = el.getBoundingClientRect();
    const bounds = el.closest('dialog')?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight };
    const below = bounds.bottom - box.bottom - 12;
    const above = box.top - bounds.top - 12;
    const need = Math.min(300, this.options().length * 48 + 12);
    this.up.set(below < need && above > below);
    this.maxHeight.set(Math.max(120, Math.min(300, this.up() ? above : below)));
    this.open.update((o) => !o);
  }

  protected pick(v: string) {
    this.value.set(v);
    this.open.set(false);
  }

  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected key(e: KeyboardEvent) {
    if (!this.open()) return;
    const n = this.options().length;
    if (e.key === 'ArrowDown') this.cursor.update((i) => (i + 1) % n);
    else if (e.key === 'ArrowUp') this.cursor.update((i) => (i - 1 + n) % n);
    else if (e.key === 'Enter') this.pick(this.options()[this.cursor()].value);
    else if (e.key === 'Escape') this.open.set(false);
    else return;
    e.preventDefault();
  }
}
