import {
  AstroTime,
  Body,
  Constellation,
  Equator,
  EquatorFromVector,
  Horizon,
  Illumination,
  MakeTime,
  MoonPhase,
  NextMoonQuarter,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchMoonQuarter,
  SearchRiseSet,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { CONSTELLATIONS } from '../data/constellations';
import { Star, STARS } from '../data/stars';

const DEG = Math.PI / 180;
const SYNODIC_MONTH_DAYS = 29.530588;
export const KM_PER_AU = 149_597_870.7;

/** SVG geometry of the sky dome. */
export const MAP = { size: 600, center: 300, radius: 290 } as const;

export interface Point {
  x: number;
  y: number;
}

/**
 * Stereographic projection centred on the zenith. The horizon (alt 0) maps to
 * the outer radius. North is up and east is left, as when looking up at the sky.
 */
export function project(altitude: number, azimuth: number): Point {
  const r = MAP.radius * Math.tan(((90 - altitude) * DEG) / 2);
  const az = azimuth * DEG;
  return { x: MAP.center - r * Math.sin(az), y: MAP.center - r * Math.cos(az) };
}

export function compass(azimuth: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(azimuth / 22.5) % 16];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------- Stars

export interface ProjectedStar extends Star, Point {
  alt: number;
  az: number;
  r: number;
  opacity: number;
  /** Entrance delay so stars ripple outward from the zenith. */
  delay: number;
}

/** Small stable per-name jitter in [0, 1) so the ripple isn't perfectly uniform. */
function jitter(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/** How washed out the sky is: 0 at full night, 1 once the Sun is up. */
export function daylight(sunAlt: number): number {
  return clamp01((sunAlt + 12) / 12);
}

/** Every catalogue star above the horizon, keyed by name. */
export function projectStars(time: AstroTime, observer: Observer, sunAlt: number): Map<string, ProjectedStar> {
  const precess = Rotation_EQJ_EQD(time);
  const dim = 1 - 0.7 * daylight(sunAlt);
  const result = new Map<string, ProjectedStar>();

  for (const star of STARS) {
    // Precess J2000 coordinates to the equator of date, then to alt/az.
    const j2000 = VectorFromSphere(new Spherical(star.dec, star.ra * 15, 1), time);
    const ofDate = EquatorFromVector(RotateVector(precess, j2000));
    const { altitude, azimuth } = Horizon(time, observer, ofDate.ra, ofDate.dec, 'normal');
    if (altitude < 0) continue;

    const point = project(altitude, azimuth);
    const distance = Math.hypot(point.x - MAP.center, point.y - MAP.center) / MAP.radius;
    result.set(star.name, {
      ...star,
      ...point,
      alt: altitude,
      az: azimuth,
      r: Math.max(0.6, 3.5 - 0.62 * (star.mag + 1.46)),
      opacity: Math.min(1, Math.max(0.5, 1.25 - star.mag * 0.17)) * dim,
      delay: Math.round(300 + distance * 900 + jitter(star.name) * 350),
    });
  }
  return result;
}

export function starConstellation(star: Star): string {
  return Constellation(star.ra, star.dec).name;
}

export interface Segment {
  id: string;
  d: string;
  delay: number;
}

/** Constellation segments whose two endpoints are both above the horizon. */
export function constellationSegments(visible: Map<string, ProjectedStar>): Segment[] {
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
          delay: 1300 + ci * 90,
        });
      }
    }
  });
  return segments;
}

export interface MapLabel extends Point {
  id: string;
  text: string;
}

/** A name at the centre of each constellation that is mostly above the horizon. */
export function constellationLabels(visible: Map<string, ProjectedStar>): MapLabel[] {
  const labels: MapLabel[] = [];
  for (const constellation of CONSTELLATIONS) {
    const names = [...new Set(constellation.lines.flat())];
    const shown = names.map((n) => visible.get(n)).filter((s): s is ProjectedStar => !!s);
    if (shown.length / names.length < 0.6) continue;
    labels.push({
      id: constellation.name,
      text: constellation.name.toUpperCase(),
      x: shown.reduce((sum, s) => sum + s.x, 0) / shown.length,
      y: shown.reduce((sum, s) => sum + s.y, 0) / shown.length + 14,
    });
  }
  return labels;
}

// ---------------------------------------------------------------- Sun, Moon, planets

export type BodyKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

export interface BodyMeta {
  key: BodyKey;
  name: string;
  body: Body;
  color: string;
}

export const SOLAR_BODIES: BodyMeta[] = [
  { key: 'sun', name: 'Sun', body: Body.Sun, color: '#ffc95e' },
  { key: 'moon', name: 'Moon', body: Body.Moon, color: '#e9e4d6' },
  { key: 'mercury', name: 'Mercury', body: Body.Mercury, color: '#b8aea2' },
  { key: 'venus', name: 'Venus', body: Body.Venus, color: '#f3dfa8' },
  { key: 'mars', name: 'Mars', body: Body.Mars, color: '#e8735a' },
  { key: 'jupiter', name: 'Jupiter', body: Body.Jupiter, color: '#dcb88c' },
  { key: 'saturn', name: 'Saturn', body: Body.Saturn, color: '#e6cc86' },
];

export const isPlanet = (key: BodyKey) => key !== 'sun' && key !== 'moon';

export interface BodyPosition extends BodyMeta, Point {
  alt: number;
  az: number;
  mag: number;
  distanceAu: number;
  up: boolean;
}

export function bodyPositions(time: AstroTime, observer: Observer): BodyPosition[] {
  return SOLAR_BODIES.map((meta) => {
    const eq = Equator(meta.body, time, observer, true, true);
    const { altitude, azimuth } = Horizon(time, observer, eq.ra, eq.dec, 'normal');
    return {
      ...meta,
      ...project(altitude, azimuth),
      alt: altitude,
      az: azimuth,
      mag: Illumination(meta.body, time).mag,
      distanceAu: eq.dist,
      up: altitude > 0,
    };
  });
}

/** IAU constellation the body appears in (uses J2000 coordinates). */
export function bodyConstellation(body: Body, time: AstroTime, observer: Observer): string {
  const eq = Equator(body, time, observer, false, true);
  return Constellation(eq.ra, eq.dec).name;
}

export interface HorizonEvent {
  label: string;
  date: Date | null;
}

/** For a body that is up: when it rose and when it will set; otherwise when it set and will rise. */
export function riseAndSet(body: Body, observer: Observer, time: AstroTime, up: boolean): [HorizonEvent, HorizonEvent] {
  const find = (direction: 1 | -1, days: number) => SearchRiseSet(body, observer, direction, time, days)?.date ?? null;
  return up
    ? [
        { label: 'Rose', date: find(+1, -1.5) },
        { label: 'Sets', date: find(-1, 1.5) },
      ]
    : [
        { label: 'Set', date: find(-1, -1.5) },
        { label: 'Rises', date: find(+1, 1.5) },
      ];
}

export interface SkyPhase {
  label: string;
  tone: 'day' | 'twilight' | 'night';
}

export function skyPhase(sunAlt: number): SkyPhase {
  if (sunAlt > -0.833) return { label: 'Daylight', tone: 'day' };
  if (sunAlt > -6) return { label: 'Civil twilight', tone: 'twilight' };
  if (sunAlt > -12) return { label: 'Nautical twilight', tone: 'twilight' };
  if (sunAlt > -18) return { label: 'Astronomical twilight', tone: 'twilight' };
  return { label: 'Night', tone: 'night' };
}

const NIGHT_DOME = ['#111a2e', '#080c16', '#04060b'];
const TWILIGHT_DOME = ['#2c3563', '#161b36', '#0b0d19'];
const DAY_DOME = ['#5577aa', '#33507f', '#1d2e50'];

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Dome gradient stops (centre, middle, rim) tinted by how high the Sun is. */
export function domeStops(sunAlt: number): string[] {
  if (sunAlt <= -6) {
    const t = clamp01((sunAlt + 18) / 12);
    return NIGHT_DOME.map((c, i) => mixHex(c, TWILIGHT_DOME[i], t));
  }
  const t = clamp01((sunAlt + 6) / 8);
  return TWILIGHT_DOME.map((c, i) => mixHex(c, DAY_DOME[i], t));
}

/** Sun altitude every `stepMin` minutes across ±`spanMin` around `base`. */
export function sunAltitudeSamples(base: Date, observer: Observer, spanMin = 720, stepMin = 10) {
  const samples: { offset: number; alt: number }[] = [];
  for (let m = -spanMin; m <= spanMin; m += stepMin) {
    const time = MakeTime(new Date(base.getTime() + m * 60_000));
    const eq = Equator(Body.Sun, time, observer, true, true);
    samples.push({ offset: m, alt: Horizon(time, observer, eq.ra, eq.dec, 'normal').altitude });
  }
  return samples;
}

// ---------------------------------------------------------------- Moon

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
];

export interface MoonInfo {
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  angle: number;
  fraction: number;
  percent: number;
  name: string;
  ageDays: number;
  /** Draw the lit side on the left instead of the right. */
  mirror: boolean;
}

export function moonInfo(time: AstroTime, latitude: number): MoonInfo {
  const angle = MoonPhase(time);
  const fraction = Illumination(Body.Moon, time).phase_fraction;
  return {
    angle,
    fraction,
    percent: Math.round(fraction * 100),
    name: PHASE_NAMES[Math.round(angle / 45) % 8],
    ageDays: (angle / 360) * SYNODIC_MONTH_DAYS,
    // Waxing moons are lit on the right as seen from the northern hemisphere;
    // waning or southern-hemisphere views mirror that.
    mirror: angle > 180 !== latitude < 0,
  };
}

/**
 * Lit part of a moon of radius r centred on the origin: a semicircle on the right
 * closed by a half-ellipse terminator whose width follows the illuminated fraction.
 */
export function moonLitPath(fraction: number, r: number): string {
  const rx = (r * Math.abs(1 - 2 * fraction)).toFixed(2);
  const sweep = fraction > 0.5 ? 1 : 0;
  return `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`;
}

/** The next full and new moons after `time`. */
export function nextFullAndNew(time: AstroTime): { full: Date; new: Date } {
  let quarter = SearchMoonQuarter(time);
  let full: Date | null = null;
  let fresh: Date | null = null;
  for (let i = 0; i < 4 && (!full || !fresh); i++) {
    if (quarter.quarter === 2 && !full) full = quarter.time.date;
    if (quarter.quarter === 0 && !fresh) fresh = quarter.time.date;
    quarter = NextMoonQuarter(quarter);
  }
  return { full: full!, new: fresh! };
}

export function moonIlluminatedFraction(date: Date): number {
  return Illumination(Body.Moon, MakeTime(date)).phase_fraction;
}
