import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import {
  Body,
  EquatorFromVector,
  Horizon,
  Illumination,
  MakeTime,
  MoonPhase,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { CONSTELLATIONS } from '../data/constellations';
import { formatCoords } from '../data/format';
import { Star, STARS } from '../data/stars';

interface ProjectedStar extends Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  /** Animation delay so stars appear in a ripple outward from the zenith. */
  delay: number;
}

interface Segment {
  id: string;
  d: string;
  delay: number;
}

type ExportState = 'idle' | 'busy' | 'error';

const DEG = Math.PI / 180;
const SIZE = 600;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 10;
const MOON = { x: 596, y: 4, r: 17 };

/**
 * Stereographic projection centred on the zenith. The horizon (alt 0) maps to
 * the outer radius. North is up and east is left, as when looking up at the sky.
 */
function project(altitude: number, azimuth: number): { x: number; y: number } {
  const r = RADIUS * Math.tan(((90 - altitude) * DEG) / 2);
  const az = azimuth * DEG;
  return { x: CENTER - r * Math.sin(az), y: CENTER - r * Math.cos(az) };
}

/** Radius from magnitude: brighter stars are larger, but only gently so. */
function starRadius(mag: number): number {
  return Math.max(0.6, 3.5 - 0.62 * (mag + 1.46));
}

/** Small stable per-name jitter in [0, 1) so the ripple isn't perfectly uniform. */
function jitter(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function moonPhaseName(angle: number): string {
  const names = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  return names[Math.round(angle / 45) % 8];
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
    background: 'radial-gradient(ellipse 110% 85% at 50% 40%, #141d33 0%, #0a0e17 45%, #000 100%)',
  });
  set(poster.querySelector('.map'), { width: '900px', height: '900px' });
  set(poster.querySelector('figcaption'), { 'max-width': '820px' });
  set(poster.querySelector('.caption'), { 'font-size': '34px' });
  set(poster.querySelector('.coords'), { 'font-size': '15px' });
  // Copied animations restart in the clone and would capture text mid-fade.
  for (const el of [poster, ...poster.querySelectorAll('*')]) set(el, { animation: 'none' });
}

@Component({
  selector: 'app-star-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './star-map.component.html',
  styleUrl: './star-map.component.scss',
})
export class StarMapComponent {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  /** The instant to show, as a UTC Date. */
  readonly date = input.required<Date>();
  /** IANA time zone the caption is written in. */
  readonly timeZone = input.required<string>();
  /** Human-readable place name for the caption. */
  readonly place = input.required<string>();

  readonly back = output<void>();

  private readonly backButton = viewChild.required<ElementRef<HTMLButtonElement>>('backButton');
  private readonly poster = viewChild.required<ElementRef<HTMLElement>>('poster');

  readonly exportState = signal<ExportState>('idle');

  readonly center = CENTER;
  readonly radius = RADIUS;
  readonly moonGeom = MOON;
  /** Faint altitude rings at 30° and 60°. */
  readonly rings = [30, 60].map((alt) => RADIUS * Math.tan(((90 - alt) * DEG) / 2));
  readonly cardinals = [
    { label: 'N', x: CENTER, y: CENTER - RADIUS - 20 },
    { label: 'E', x: CENTER - RADIUS - 20, y: CENTER },
    { label: 'S', x: CENTER, y: CENTER + RADIUS + 20 },
    { label: 'W', x: CENTER + RADIUS + 20, y: CENTER },
  ];

  private readonly time = computed(() => MakeTime(this.date()));

  /** Every catalogue star above the horizon, keyed by name. */
  private readonly visible = computed(() => {
    const time = this.time();
    const observer = new Observer(this.latitude(), this.longitude(), 0);
    const precess = Rotation_EQJ_EQD(time);
    const result = new Map<string, ProjectedStar>();

    for (const star of STARS) {
      // Precess J2000 coordinates to the equator of date, then to alt/az.
      const j2000 = VectorFromSphere(new Spherical(star.dec, star.ra * 15, 1), time);
      const ofDate = EquatorFromVector(RotateVector(precess, j2000));
      const { altitude, azimuth } = Horizon(time, observer, ofDate.ra, ofDate.dec, 'normal');
      if (altitude < 0) continue;

      const { x, y } = project(altitude, azimuth);
      const distance = Math.hypot(x - CENTER, y - CENTER) / RADIUS;
      result.set(star.name, {
        ...star,
        x,
        y,
        r: starRadius(star.mag),
        opacity: Math.min(1, Math.max(0.5, 1.25 - star.mag * 0.17)),
        delay: Math.round(500 + distance * 900 + jitter(star.name) * 350),
      });
    }
    return result;
  });

  /** Drawn faintest first so bright stars sit on top. */
  readonly stars = computed(() => [...this.visible().values()].sort((a, b) => b.mag - a.mag));

  readonly brightStars = computed(() => this.stars().filter((s) => s.mag < 1.5));

  /** Constellation segments whose two endpoints are both above the horizon. */
  readonly segments = computed<Segment[]>(() => {
    const visible = this.visible();
    const segments: Segment[] = [];
    CONSTELLATIONS.forEach((constellation, ci) => {
      for (const line of constellation.lines) {
        for (let i = 1; i < line.length; i++) {
          const a = visible.get(line[i - 1]);
          const b = visible.get(line[i]);
          if (!a || !b) continue;
          segments.push({
            id: `${constellation.name}:${a.name}-${b.name}`,
            d: `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
            delay: 1500 + ci * 90,
          });
        }
      }
    });
    return segments;
  });

  readonly moon = computed(() => {
    const time = this.time();
    const angle = MoonPhase(time); // 0 = new, 90 = first quarter, 180 = full, 270 = last quarter
    const fraction = Illumination(Body.Moon, time).phase_fraction;
    const { r } = MOON;

    // Lit limb is a semicircle on the right; the terminator is a half-ellipse
    // whose width shrinks to zero at quarter phase and flips side past it.
    const rx = (r * Math.abs(1 - 2 * fraction)).toFixed(2);
    const sweep = fraction > 0.5 ? 1 : 0;
    const litPath = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`;

    // Waxing moons are lit on the right as seen from the northern hemisphere;
    // waning or southern-hemisphere views mirror that.
    const waning = angle > 180;
    const southern = this.latitude() < 0;
    return {
      litPath,
      mirror: waning !== southern,
      name: moonPhaseName(angle),
      percent: Math.round(fraction * 100),
    };
  });

  readonly caption = computed(() => {
    const timeZone = this.timeZone();
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone }).format(this.date());
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone }).format(this.date());
    return { place: this.place(), date, time, text: `The sky over ${this.place()} on ${date} at ${time}.` };
  });

  /** Coordinates line, unless the place name already is the coordinates. */
  readonly coords = computed(() => {
    const coords = formatCoords(this.latitude(), this.longitude());
    return coords === this.place() ? null : coords.replace(', ', '  ·  ');
  });

  focusBack(): void {
    this.backButton().nativeElement.focus();
  }

  async exportPng(): Promise<void> {
    if (this.exportState() === 'busy') return;
    this.exportState.set('busy');
    try {
      const { default: html2canvas } = await import('html2canvas');
      // Render a fixed 4:5 poster regardless of the current viewport.
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

      const day = new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone() }).format(this.date());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sky-over-${slug(this.place()) || 'here'}-${day}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportState.set('idle');
    } catch (error) {
      console.error('PNG export failed', error);
      this.exportState.set('error');
    }
  }
}
