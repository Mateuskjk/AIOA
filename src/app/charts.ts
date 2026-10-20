import { Component, computed, input, signal } from '@angular/core';

/** Categorical slots for donuts and pies, validated on the chart surface (#0e0e10): band, chroma, CVD, contrast. */
export const SERIES = ['#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#3987e5'];

export interface Datum {
  label: string;
  value: number;
  /** Long name for tooltips when `label` is abbreviated. */
  name?: string;
}

/** Rounds a max up to a readable axis top that splits cleanly into quarters (e.g. 23 -> 24, 31 -> 40). */
export const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 1.2, 1.6, 2, 2.4, 4, 6, 8, 10].find((m) => m * p >= v) ?? 10) * p;
};
const num = (v: number, max = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: max });

/** Vertical columns with the value on top; data ends rounded, anchored to the baseline. */
@Component({
  selector: 'app-column-chart',
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="aria()">
        @for (g of grid(); track g.v) {
          <line class="c-grid" [attr.x1]="P.l" [attr.x2]="W - P.r" [attr.y1]="g.y" [attr.y2]="g.y" />
          <text class="c-axis" [attr.x]="P.l - 8" [attr.y]="g.y + 4" text-anchor="end">{{ num(g.v) }}</text>
        }
        @for (c of cols(); track c.label; let i = $index) {
          <path class="c-col" [class.dim]="hover() != null && hover() !== i" [attr.d]="c.d" />
          <text class="c-value" [attr.x]="c.x" [attr.y]="c.y - 8" text-anchor="middle">{{ num(c.value) }}</text>
          <text class="c-axis c-cat" [attr.x]="c.x" [attr.y]="H - 8" text-anchor="middle">{{ c.label }}</text>
          <rect class="c-hit" [attr.x]="c.x - slot() / 2" [attr.y]="P.t" [attr.width]="slot()" [attr.height]="H - P.t - P.b" (mouseenter)="hover.set(i)" />
        }
      </svg>
      @if (hover() != null) {
        <div class="c-tip" [style.left.%]="(cols()[hover()!].x / W) * 100" [style.top.%]="(cols()[hover()!].y / H) * 100">
          <small>{{ cols()[hover()!].name ?? cols()[hover()!].label }}</small><b>{{ num(cols()[hover()!].value) }}</b> {{ unit() }}
        </div>
      }
      @if (!data().length) { <p class="c-empty">Sem dados.</p> }
    </div>
  `,
})
export class ColumnChart {
  readonly data = input.required<Datum[]>();
  readonly unit = input('');
  readonly aria = input('');
  protected readonly W = 480;
  protected readonly H = 160;
  protected readonly P = { l: 30, r: 8, t: 20, b: 24 };
  protected readonly num = num;
  protected readonly hover = signal<number | null>(null);

  private readonly top = computed(() => niceMax(Math.max(0, ...this.data().map((d) => d.value))));
  private readonly y = (v: number) => this.H - this.P.b - (v / this.top()) * (this.H - this.P.t - this.P.b);
  protected readonly slot = computed(() => (this.W - this.P.l - this.P.r) / Math.max(1, this.data().length));
  protected readonly grid = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: this.top() * f, y: this.y(this.top() * f) })));
  protected readonly cols = computed(() =>
    this.data().map((d, i) => {
      const x = this.P.l + this.slot() * (i + 0.5);
      const w = Math.min(90, this.slot() * 0.5);
      const top = this.y(d.value);
      const h = this.H - this.P.b - top;
      const r = Math.min(4, h, w / 2);
      const x0 = x - w / 2;
      const d_ = `M${x0},${top + h}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top + r}V${top + h}Z`;
      return { ...d, x, y: top, d: d_ };
    }),
  );
}

/** Donut with the total in the middle and "label n (p%)" outside each slice. */
@Component({
  selector: 'app-donut',
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="aria()">
        @for (s of slices(); track s.label; let i = $index) {
          <path class="d-slice" [class.dim]="hover() != null && hover() !== i" [attr.d]="s.d" [attr.fill]="s.color" (mouseenter)="hover.set(i)" />
        }
        @for (s of slices(); track s.label) {
          <text class="d-label" [attr.y]="s.ly" [attr.text-anchor]="s.anchor">
            <tspan [attr.x]="s.lx">{{ s.label }}</tspan>
            <tspan class="d-sub" [attr.x]="s.lx" dy="12">{{ s.value }} · {{ s.pct }}</tspan>
          </text>
        }
        <text class="d-total" [attr.x]="cx" [attr.y]="cy + 8" text-anchor="middle">{{ total() }}</text>
      </svg>
      @if (hover() != null) {
        <div class="c-tip" [style.left.%]="(slices()[hover()!].tx / W) * 100" [style.top.%]="(slices()[hover()!].ty / H) * 100">
          <small>{{ slices()[hover()!].label }}</small><b>{{ slices()[hover()!].value }}</b> {{ unit() }} · {{ slices()[hover()!].pct }}
        </div>
      }
      @if (!total()) { <p class="c-empty">Sem dados.</p> }
    </div>
  `,
})
export class Donut {
  readonly data = input.required<Datum[]>();
  readonly unit = input('');
  readonly aria = input('');
  protected readonly W = 520;
  protected readonly H = 210;
  protected readonly cx = 260;
  protected readonly cy = 100;
  private readonly R = 64;
  private readonly r = 40;
  protected readonly hover = signal<number | null>(null);

  protected readonly total = computed(() => this.data().reduce((a, d) => a + d.value, 0));

  protected readonly slices = computed(() => {
    const total = this.total() || 1;
    const gap = this.data().filter((d) => d.value).length > 1 ? 0.025 : 0; // ~2px surface gap between slices
    let a0 = -Math.PI / 2;
    const out = this.data()
      .map((d, i) => ({ ...d, color: SERIES[i % SERIES.length] })) // colour follows the entity, not its rank
      .filter((d) => d.value > 0)
      .map((d) => {
        const sweep = (d.value / total) * Math.PI * 2;
        const [s, e] = [a0 + gap / 2, a0 + sweep - gap / 2];
        a0 += sweep;
        const pt = (rad: number, a: number) => [this.cx + rad * Math.cos(a), this.cy + rad * Math.sin(a)];
        const [x1, y1] = pt(this.R, s), [x2, y2] = pt(this.R, e), [x3, y3] = pt(this.r, e), [x4, y4] = pt(this.r, s);
        const large = e - s > Math.PI ? 1 : 0;
        const mid = (s + e) / 2;
        const [lx, ly] = pt(this.R + 14, mid);
        const [tx, ty] = pt(this.R, mid);
        return {
          ...d,
          pct: `${num((d.value / total) * 100, 1)}%`,
          d: `M${x1},${y1}A${this.R},${this.R} 0 ${large} 1 ${x2},${y2}L${x3},${y3}A${this.r},${this.r} 0 ${large} 0 ${x4},${y4}Z`,
          lx, ly: ly - 2, tx, ty,
          anchor: Math.cos(mid) >= 0 ? 'start' : 'end',
        };
      });
    // Keep two-line labels on each side apart so thin neighbouring slices stay readable.
    for (const side of ['start', 'end']) {
      const ls = out.filter((o) => o.anchor === side).sort((a, b) => a.ly - b.ly);
      for (let i = 1; i < ls.length; i++) if (ls[i].ly - ls[i - 1].ly < 26) ls[i].ly = ls[i - 1].ly + 26;
    }
    return out;
  });
}

/** Ranked thick bars: position number, then the bar with name and value at its end. */
@Component({
  selector: 'app-rank-bars',
  template: `
    <ol class="rank-bars">
      @for (r of data(); track r.label; let i = $index) {
        <li [attr.aria-label]="i + 1 + 'º ' + r.label + ': ' + num(r.value)">
          <span class="rb-pos">{{ i + 1 }}º</span>
          <span class="rb-track">
            <i class="rb-bar" [style.width.%]="(r.value / max()) * 50"></i>
            <span class="rb-text"><b [title]="r.label">{{ r.label }}</b><small>{{ num(r.value) }}</small></span>
          </span>
        </li>
      } @empty {
        <li class="c-empty">Sem dados.</li>
      }
    </ol>
  `,
})
export class RankBars {
  readonly data = input.required<Datum[]>();
  protected readonly num = num;
  protected readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
}

/** Smoothed line with a gradient area, a value on every point and a hover crosshair. */
@Component({
  selector: 'app-area-chart',
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="aria()">
        <defs>
          <linearGradient [attr.id]="gid" x1="0" x2="0" y1="0" y2="1">
            <stop class="a-stop" offset="0" stop-opacity="0.45" />
            <stop class="a-stop" offset="1" stop-opacity="0" />
          </linearGradient>
        </defs>
        @for (g of grid(); track g.v) {
          <line class="c-grid" [attr.x1]="P.l" [attr.x2]="W - P.r" [attr.y1]="g.y" [attr.y2]="g.y" />
          <text class="c-axis" [attr.x]="P.l - 10" [attr.y]="g.y + 4" text-anchor="end">{{ num(g.v) }}</text>
        }
        @for (p of pts(); track p.label) {
          <line class="c-grid" [attr.x1]="p.x" [attr.x2]="p.x" [attr.y1]="P.t" [attr.y2]="H - P.b" />
        }
        <path [attr.d]="area()" [attr.fill]="'url(#' + gid + ')'" />
        <path class="a-line" [attr.d]="line()" />
        @if (hover() != null) {
          <line class="a-cross" [attr.x1]="pts()[hover()!].x" [attr.x2]="pts()[hover()!].x" [attr.y1]="P.t" [attr.y2]="H - P.b" />
          <circle class="a-dot" [attr.cx]="pts()[hover()!].x" [attr.cy]="pts()[hover()!].y" r="5" />
        }
        @for (p of pts(); track p.label; let i = $index) {
          <text class="c-value" [attr.x]="p.x" [attr.y]="p.y - 10" text-anchor="middle">{{ num(p.value) }}</text>
          <text class="c-axis" [attr.x]="p.x" [attr.y]="H - 8" text-anchor="middle">{{ p.label }}</text>
          <rect class="c-hit" [attr.x]="p.x - slot() / 2" [attr.y]="P.t" [attr.width]="slot()" [attr.height]="H - P.t - P.b" (mouseenter)="hover.set(i)" />
        }
      </svg>
      @if (hover() != null) {
        <div class="c-tip" [style.left.%]="(pts()[hover()!].x / W) * 100" [style.top.%]="(pts()[hover()!].y / H) * 100">
          <small>{{ pts()[hover()!].label }}</small><b>{{ num(pts()[hover()!].value) }}</b> {{ unit() }}
        </div>
      }
    </div>
  `,
})
export class AreaChart {
  readonly data = input.required<Datum[]>();
  readonly unit = input('');
  readonly aria = input('');
  protected readonly W = 760;
  protected readonly H = 250;
  protected readonly P = { l: 36, r: 26, t: 24, b: 26 };
  protected readonly num = num;
  protected readonly hover = signal<number | null>(null);
  protected readonly gid = `area-${Math.random().toString(36).slice(2, 8)}`;

  private readonly top = computed(() => niceMax(Math.max(0, ...this.data().map((d) => d.value)) * 1.1));
  private readonly y = (v: number) => this.H - this.P.b - (v / this.top()) * (this.H - this.P.t - this.P.b);
  protected readonly slot = computed(() => (this.W - this.P.l - this.P.r) / Math.max(1, this.data().length - 1));
  protected readonly grid = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: this.top() * f, y: this.y(this.top() * f) })));
  protected readonly pts = computed(() =>
    this.data().map((d, i) => ({ ...d, x: this.P.l + (this.data().length > 1 ? this.slot() * i : 0), y: this.y(d.value) })),
  );

  /** Catmull-Rom spline as cubic Béziers; control points clamped to the plot so the curve never dips below 0. */
  protected readonly line = computed(() => {
    const p = this.pts();
    if (p.length < 2) return p.length ? `M${p[0].x},${p[0].y}` : '';
    const clamp = (v: number) => Math.min(this.H - this.P.b, Math.max(this.P.t, v));
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b, c, e] = [p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1]];
      d += `C${b.x + (c.x - a.x) / 6},${clamp(b.y + (c.y - a.y) / 6)} ${c.x - (e.x - b.x) / 6},${clamp(c.y - (e.y - b.y) / 6)} ${c.x},${c.y}`;
    }
    return d;
  });
  protected readonly area = computed(() => {
    const p = this.pts();
    return p.length ? `${this.line()}L${p.at(-1)!.x},${this.H - this.P.b}L${p[0].x},${this.H - this.P.b}Z` : '';
  });
}


const TAU = Math.PI * 2;

/**
 * Tilted (3D-look) pie: an elliptical top plus the visible front wall.
 * ponytail: tilt makes front slices look bigger; every slice carries its count and % so reading doesn't rely on area.
 */
@Component({
  selector: 'app-pie-3d',
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="aria()">
        @for (w of walls(); track $index) {
          <path class="p-wall" [class.dim]="hover() != null && hover() !== w.i" [attr.d]="w.d" [attr.fill]="w.color" />
        }
        @for (s of slices(); track s.label; let i = $index) {
          <path class="p-top" [class.dim]="hover() != null && hover() !== i" [attr.d]="s.d" [attr.fill]="s.color" (mouseenter)="hover.set(i)" />
        }
        @for (s of slices(); track s.label) {
          <text class="d-label" [attr.y]="s.ly" [attr.text-anchor]="s.anchor">
            <tspan [attr.x]="s.lx">{{ s.label }}</tspan>
            <tspan class="d-sub" [attr.x]="s.lx" dy="12">{{ s.value }} · {{ s.pct }}</tspan>
          </text>
        }
      </svg>
      @if (hover() != null) {
        <div class="c-tip" [style.left.%]="(slices()[hover()!].tx / W) * 100" [style.top.%]="(slices()[hover()!].ty / H) * 100">
          <small>{{ slices()[hover()!].label }}</small><b>{{ slices()[hover()!].value }}</b> {{ unit() }} · {{ slices()[hover()!].pct }}
        </div>
      }
      @if (!total()) { <p class="c-empty">Sem dados.</p> }
    </div>
  `,
})
export class Pie3D {
  readonly data = input.required<Datum[]>();
  readonly unit = input('');
  readonly aria = input('');
  protected readonly W = 520;
  protected readonly H = 210;
  private readonly cx = 260;
  private readonly cy = 92;
  private readonly rx = 82;
  private readonly ry = 44;
  private readonly depth = 16;
  protected readonly hover = signal<number | null>(null);

  protected readonly total = computed(() => this.data().reduce((a, d) => a + d.value, 0));
  private readonly pt = (a: number, dy = 0, grow = 0) =>
    [this.cx + (this.rx + grow) * Math.cos(a), this.cy + (this.ry + grow) * Math.sin(a) + dy] as const;

  /** Angles run clockwise from 12 o'clock; colour follows the category, not its rank. */
  private readonly arcs = computed(() => {
    const total = this.total() || 1;
    let a = -Math.PI / 2;
    return this.data()
      .map((d, i) => ({ ...d, color: SERIES[i % SERIES.length] }))
      .filter((d) => d.value > 0)
      .map((d) => {
        const s = a;
        a += (d.value / total) * TAU;
        return { ...d, s, e: a };
      });
  });

  protected readonly slices = computed(() => {
    const total = this.total() || 1;
    const out = this.arcs().map((d) => {
      const [x1, y1] = this.pt(d.s);
      const [x2, y2] = this.pt(d.e);
      const mid = (d.s + d.e) / 2;
      const front = Math.sin(mid) > 0;
      const [lx, ly] = this.pt(mid, front ? this.depth : 0, 14);
      const [tx, ty] = this.pt(mid, 0, -this.rx * 0.4);
      return {
        ...d,
        pct: `${num((d.value / total) * 100, 1)}%`,
        d: `M${this.cx},${this.cy}L${x1},${y1}A${this.rx},${this.ry} 0 ${d.e - d.s > Math.PI ? 1 : 0} 1 ${x2},${y2}Z`,
        lx, ly: ly - 2, tx, ty,
        anchor: Math.cos(mid) >= 0 ? 'start' : 'end',
      };
    });
    for (const side of ['start', 'end']) {
      const ls = out.filter((o) => o.anchor === side).sort((a, b) => a.ly - b.ly);
      for (let i = 1; i < ls.length; i++) if (ls[i].ly - ls[i - 1].ly < 26) ls[i].ly = ls[i - 1].ly + 26; // two-line labels
    }
    return out;
  });

  /** Front wall pieces: the part of each slice's rim facing the viewer (angles 0..π, i.e. the lower half). */
  protected readonly walls = computed(() =>
    this.arcs().flatMap((d, i) => {
      const norm = (x: number) => ((x % TAU) + TAU) % TAU;
      const s = norm(d.s);
      const e = s + (d.e - d.s);
      const ranges = e <= TAU ? [[s, e]] : [[s, TAU], [0, e - TAU]];
      return ranges
        .map(([a, b]) => [Math.max(a, 0), Math.min(b, Math.PI)])
        .filter(([a, b]) => b > a)
        .map(([a, b]) => {
          const [x1, y1] = this.pt(a);
          const [x2, y2] = this.pt(b);
          const h = this.depth;
          return { i, color: d.color, d: `M${x1},${y1}A${this.rx},${this.ry} 0 0 1 ${x2},${y2}L${x2},${y2 + h}A${this.rx},${this.ry} 0 0 0 ${x1},${y1 + h}Z` };
        });
    }),
  );
}
