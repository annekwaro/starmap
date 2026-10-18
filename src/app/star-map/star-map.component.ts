import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { BodyPosition, MapLabel, MAP, moonLitPath, MoonInfo, Point, ProjectedStar, Segment } from '../astro/astro';

const CORNER_MOON = { x: 596, y: 4, r: 17 };

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
  set(poster.querySelector('.map'), { width: '900px', height: '900px', 'max-width': 'none' });
  set(poster.querySelector('figcaption'), { 'max-width': '820px' });
  set(poster.querySelector('.caption'), { 'font-size': '34px' });
  set(poster.querySelector('.coords'), { 'font-size': '15px' });
  // Copied animations restart in the clone and would capture text mid-fade.
  for (const el of [poster, ...poster.querySelectorAll('*')]) set(el, { animation: 'none' });
}

/** Renders a projected sky as an SVG poster. Purely presentational. */
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
  readonly selectedPoint = input<Point | null>(null);

  /** Emits the tapped star/body name, or null when the empty sky is tapped. */
  readonly select = output<string | null>();

  private readonly poster = viewChild.required<ElementRef<HTMLElement>>('poster');

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

  protected readonly brightStars = computed(() => this.stars().filter((s) => s.mag < 1.5));
  protected readonly namedStars = computed(() => this.stars().filter((s) => s.mag < 1));
  protected readonly visibleBodies = computed(() => (this.showPlanets() ? this.bodies().filter((b) => b.up) : []));
  protected readonly cornerLitPath = computed(() => moonLitPath(this.moon().fraction, CORNER_MOON.r));
  protected readonly skyMoonLitPath = computed(() => moonLitPath(this.moon().fraction, 6));

  protected pick(event: Event, name: string): void {
    event.stopPropagation();
    this.select.emit(name);
  }

  async exportPng(): Promise<void> {
    const { default: html2canvas } = await import('html2canvas');
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
  }
}
