import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  BodyPosition,
  compass,
  figuresOf,
  isPlanet,
  MapLabel,
  MAP,
  moonLitPath,
  MoonInfo,
  Point,
  ProjectedStar,
  Segment,
  starConstellation,
  unproject,
} from '../astro/astro';

const CORNER_MOON = { x: 596, y: 4, r: 17 };

/** The SVG viewBox: a square window onto the map, in map units. */
interface View {
  x: number;
  y: number;
  size: number;
}

const FULL: View = { x: -40, y: -40, size: 680 };
const MAX_ZOOM = 6;
/** Pointer travel, in CSS px, before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function clampView(v: View): View {
  const size = Math.min(FULL.size, Math.max(FULL.size / MAX_ZOOM, v.size));
  const half = size / 2;
  const min = FULL.x + half;
  const max = FULL.x + FULL.size - half;
  const cx = Math.min(max, Math.max(min, v.x + v.size / 2));
  const cy = Math.min(max, Math.max(min, v.y + v.size / 2));
  return { x: cx - half, y: cy - half, size };
}

/**
 * html2canvas copies every computed style inline onto its clone, so class-based
 * overrides lose; the export layout has to be applied as inline styles too.
 */
function styleForExport(poster: HTMLElement): void {
  const set = (el: Element | null, styles: Record<string, string>) => {
    for (const [prop, value] of Object.entries(styles)) (el as HTMLElement | null)?.style.setProperty(prop, value);
  };
  set(poster, {
    flex: 'none',
    width: '1080px',
    height: '1350px',
    padding: '80px',
    gap: '44px',
    'justify-content': 'center',
    background: 'radial-gradient(ellipse 110% 85% at 50% 40%, #141d33 0%, #0a0e17 45%, #000 100%)',
  });
  set(poster.querySelector('.stage'), { width: '900px', height: '900px', 'max-width': 'none' });
  set(poster.querySelector('figcaption'), { 'max-width': '820px' });
  set(poster.querySelector('.caption'), { 'font-size': '34px' });
  set(poster.querySelector('.coords'), { 'font-size': '15px' });
  // Live-only decoration: shooting stars, hover and constellation highlights.
  poster.querySelectorAll('.meteors, .hover-ring, .figure-hl').forEach((el) => el.remove());
  set(poster.querySelector('.lines'), { opacity: '1' });
  // Copied animations restart in the clone and would capture text mid-fade.
  for (const el of [poster, ...poster.querySelectorAll('*')]) set(el, { animation: 'none' });
}

export interface HoverInfo extends Point {
  name: string;
  kind: string;
  color: string;
  lines: string[];
}

/**
 * Renders a projected sky as an SVG poster, with zoom, pan, pinch and hover
 * details layered on top. The overlay is ignored by the PNG export.
 */
@Component({
  selector: 'app-star-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './star-map.component.html',
  styleUrl: './star-map.component.scss',
})
export class StarMapComponent {
  readonly stars = input.required<ProjectedStar[]>();
  readonly segments = input.required<Segment[]>();
  readonly labels = input.required<MapLabel[]>();
  readonly bodies = input.required<BodyPosition[]>();
  readonly moon = input.required<MoonInfo>();
  /** Dome gradient stops: centre, middle, rim. */
  readonly dome = input.required<string[]>();
  readonly caption = input.required<{ place: string; date: string; time: string; text: string }>();
  readonly coords = input<string | null>(null);
  readonly fileName = input('sky.png');
  readonly showLines = input(true);
  readonly showNames = input(false);
  readonly showPlanets = input(true);
  /** Occasional shooting stars; only worth it on a dark sky. */
  readonly meteors = input(false);
  readonly selectedPoint = input<(Point & { name: string }) | null>(null);

  /** Emits the tapped star/body name, or null when the empty sky is tapped. */
  readonly select = output<string | null>();

  private readonly poster = viewChild.required<ElementRef<HTMLElement>>('poster');
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly center = MAP.center;
  protected readonly radius = MAP.radius;
  protected readonly cornerMoon = CORNER_MOON;
  /** Faint altitude rings at 30° and 60°. */
  protected readonly rings = [30, 60].map((alt) => MAP.radius * Math.tan(((90 - alt) * Math.PI) / 360));
  protected readonly cardinals = [
    { label: 'N', x: MAP.center, y: MAP.center - MAP.radius - 20 },
    { label: 'E', x: MAP.center - MAP.radius - 20, y: MAP.center },
    { label: 'S', x: MAP.center, y: MAP.center + MAP.radius + 20 },
    { label: 'W', x: MAP.center + MAP.radius + 20, y: MAP.center },
  ];
  protected readonly sansFont = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  protected readonly monoFont = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  protected readonly serifFont = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
  protected readonly meteorTrails = [
    { x: 120, y: 140, angle: 18, duration: 13, delay: 4 },
    { x: 330, y: 90, angle: 34, duration: 19, delay: 11 },
    { x: 180, y: 360, angle: -12, duration: 23, delay: 17 },
  ];

  // ---- View: zoom and pan

  protected readonly view = signal<View>(FULL);
  readonly zoom = computed(() => FULL.size / this.view().size);
  /** Marks shrink as the map zooms so a close-up reads as more sky, not bigger dots. */
  protected readonly k = computed(() => 1 / Math.sqrt(this.zoom()));
  protected readonly viewBox = computed(() => {
    const v = this.view();
    return `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.size.toFixed(2)} ${v.size.toFixed(2)}`;
  });
  protected readonly zoomLabel = computed(() => `${this.zoom().toFixed(this.zoom() < 10 ? 1 : 0)}×`);

  private animation = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pressOrigin: { x: number; y: number } | null = null;
  private suppressClick = false;
  protected readonly dragging = signal(false);

  // ---- Hover

  protected readonly hovered = signal<string | null>(null);
  /** Alt/az under the mouse, for the corner readout. */
  protected readonly cursor = signal<{ alt: number; az: number } | null>(null);

  protected readonly brightStars = computed(() => this.stars().filter((s) => s.mag < 1.5));
  protected readonly namedStars = computed(() => this.stars().filter((s) => s.mag < 1));
  protected readonly visibleBodies = computed(() => (this.showPlanets() ? this.bodies().filter((b) => b.up) : []));
  protected readonly cornerLitPath = computed(() => moonLitPath(this.moon().fraction, CORNER_MOON.r));
  protected readonly skyMoonLitPath = computed(() => moonLitPath(this.moon().fraction, 6));
  private readonly starsByName = computed(() => new Map(this.stars().map((s) => [s.name, s])));

  protected readonly hoverInfo = computed<HoverInfo | null>(() => {
    const name = this.hovered();
    if (!name) return null;
    const star = this.starsByName().get(name);
    if (star) {
      return {
        name,
        kind: 'Star',
        color: star.color ?? '#fff',
        x: star.x,
        y: star.y,
        lines: [`in ${starConstellation(star)}`, `mag ${star.mag.toFixed(2)} · ${star.alt.toFixed(0)}° ${compass(star.az)}`],
      };
    }
    const body = this.visibleBodies().find((b) => b.name === name);
    if (!body) return null;
    return {
      name,
      kind: isPlanet(body.key) ? 'Planet' : body.key === 'sun' ? 'Our star' : 'Moon',
      color: body.color,
      x: body.x,
      y: body.y,
      lines: [
        body.key === 'moon' ? `${this.moon().name} · ${this.moon().percent}%` : `mag ${body.mag.toFixed(1)}`,
        `${body.alt.toFixed(0)}° ${compass(body.az)}`,
      ],
    };
  });

  /** Tooltip anchor as a percentage of the visible map, or null when off-screen. */
  protected readonly tooltip = computed(() => {
    const info = this.hoverInfo();
    if (!info || this.dragging()) return null;
    const v = this.view();
    const left = ((info.x - v.x) / v.size) * 100;
    const top = ((info.y - v.y) / v.size) * 100;
    if (left < 0 || left > 100 || top < 0 || top > 100) return null;
    return { info, left, top, flipX: left > 62, below: top < 22 };
  });

  /** Constellation figures to light up: the hovered star's, else the selected one's. */
  protected readonly activeFigures = computed(() => {
    const name = this.hovered() ?? this.selectedPoint()?.name;
    return new Set(name ? figuresOf(name) : []);
  });
  protected readonly activeSegments = computed(() => {
    const figures = this.activeFigures();
    return figures.size ? this.segments().filter((s) => figures.has(s.figure)) : [];
  });
  protected readonly activeLabels = computed(() => {
    const figures = this.activeFigures();
    return this.labels().filter((l) => figures.has(l.id));
  });

  protected readonly hoverPoint = computed<Point | null>(() => {
    const info = this.hoverInfo();
    return info && info.name !== this.selectedPoint()?.name ? info : null;
  });

  protected readonly readout = computed(() => {
    const c = this.cursor();
    if (!c) return null;
    return { alt: `${c.alt.toFixed(1)}°`, az: `${c.az.toFixed(0)}° ${compass(c.az)}` };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.animation));
  }

  // ---- Public controls

  zoomBy(factor: number): void {
    const v = this.view();
    this.animateTo(this.zoomedAt(v, factor, v.x + v.size / 2, v.y + v.size / 2));
  }

  resetView(): void {
    this.animateTo(FULL);
  }

  /** Glide to a point, zooming in if the map is still wide. */
  focus(point: Point, zoom = 3): void {
    const size = FULL.size / Math.max(zoom, this.zoom());
    this.animateTo(clampView({ x: point.x - size / 2, y: point.y - size / 2, size }));
  }

  // ---- Pointer handling

  private toMap(clientX: number, clientY: number): Point {
    const rect = this.svg().nativeElement.getBoundingClientRect();
    const v = this.view();
    return { x: v.x + ((clientX - rect.left) / rect.width) * v.size, y: v.y + ((clientY - rect.top) / rect.height) * v.size };
  }

  private zoomedAt(v: View, factor: number, x: number, y: number): View {
    const size = Math.min(FULL.size, Math.max(FULL.size / MAX_ZOOM, v.size / factor));
    const s = size / v.size;
    return clampView({ x: x - (x - v.x) * s, y: y - (y - v.y) * s, size });
  }

  private animateTo(target: View, duration = 480): void {
    cancelAnimationFrame(this.animation);
    const from = this.view();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.view.set(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = easeOutCubic(Math.min(1, (now - start) / duration));
      this.view.set({
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t,
        size: from.size + (target.size - from.size) * t,
      });
      if (t < 1) this.animation = requestAnimationFrame(step);
    };
    this.animation = requestAnimationFrame(step);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    cancelAnimationFrame(this.animation);
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const p = this.toMap(event.clientX, event.clientY);
    this.view.set(this.zoomedAt(this.view(), Math.exp(-delta * 0.0018), p.x, p.y));
  }

  protected onPointerDown(event: PointerEvent): void {
    cancelAnimationFrame(this.animation);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pressOrigin = { x: event.clientX, y: event.clientY };
    if (this.pointers.size === 2) this.beginDrag(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    const last = this.pointers.get(event.pointerId);

    if (!last) {
      if (event.pointerType === 'mouse') {
        const p = this.toMap(event.clientX, event.clientY);
        this.cursor.set(unproject(p.x, p.y));
      }
      return;
    }

    if (this.pointers.size >= 2) {
      // Pinch: zoom by the change in finger spread, about the midpoint, and pan with it.
      const [a, b] = [...this.pointers.entries()];
      const other = a[0] === event.pointerId ? b[1] : a[1];
      const before = Math.hypot(last.x - other.x, last.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      const midBefore = this.toMap((last.x + other.x) / 2, (last.y + other.y) / 2);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const zoomed = this.zoomedAt(this.view(), before ? after / before : 1, midBefore.x, midBefore.y);
      this.view.set(zoomed);
      const midAfter = this.toMap((event.clientX + other.x) / 2, (event.clientY + other.y) / 2);
      this.view.set(clampView({ ...zoomed, x: zoomed.x - (midAfter.x - midBefore.x), y: zoomed.y - (midAfter.y - midBefore.y) }));
      return;
    }

    if (!this.dragging()) {
      const origin = this.pressOrigin!;
      // A wide map has nothing to pan to; leave the gesture to the page.
      if (this.zoom() <= 1.001 || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < DRAG_THRESHOLD) return;
      this.beginDrag(event);
    }

    const rect = this.svg().nativeElement.getBoundingClientRect();
    const v = this.view();
    const scale = v.size / rect.width;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.view.set(clampView({ ...v, x: v.x - (event.clientX - last.x) * scale, y: v.y - (event.clientY - last.y) * scale }));
  }

  private beginDrag(event: PointerEvent): void {
    this.dragging.set(true);
    this.hovered.set(null);
    this.svg().nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      if (this.dragging()) {
        // The click that follows a drag isn't a tap on the sky.
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false));
      }
      this.dragging.set(false);
      this.pressOrigin = null;
    }
  }

  protected onPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.cursor.set(null);
  }

  protected onSkyClick(): void {
    if (!this.suppressClick) this.select.emit(null);
  }

  protected pick(event: Event, name: string): void {
    event.stopPropagation();
    if (!this.suppressClick) this.select.emit(name);
  }

  protected hover(event: PointerEvent, name: string | null): void {
    if (event.pointerType !== 'touch' && !this.dragging()) this.hovered.set(name);
  }

  // ---- Export

  async exportPng(): Promise<void> {
    const { default: html2canvas } = await import('html2canvas');

    // The poster is always the whole sky, whatever the current zoom.
    const saved = this.view();
    cancelAnimationFrame(this.animation);
    this.view.set(FULL);
    this.hovered.set(null);
    this.cdr.detectChanges();

    try {
      // Render a fixed 4:5 poster regardless of the current viewport.
      const canvas = await html2canvas(this.poster().nativeElement, {
        backgroundColor: '#000',
        scale: 2,
        logging: false,
        windowWidth: 1200,
        windowHeight: 1500,
        onclone: (_doc, el) => styleForExport(el),
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Canvas produced no image');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.fileName();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.view.set(saved);
    }
  }
}
