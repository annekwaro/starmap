import { computed, Injectable, signal } from '@angular/core';
import { AstroTime, MakeTime, Observer } from 'astronomy-engine';
import {
  bodyConstellation,
  bodyPositions,
  compass,
  constellationLabels,
  constellationSegments,
  domeStops,
  isPlanet,
  KM_PER_AU,
  moonIlluminatedFraction,
  moonInfo,
  nextFullAndNew,
  projectStars,
  riseAndSet,
  skyPhase,
  starConstellation,
  sunAltitudeSamples,
} from '../astro/astro';
import { formatCoords } from '../data/format';
import { zonedTimeToUtc } from '../data/zoned-time';
import { SkyQuery } from './sky-query';

const DAY_MS = 86_400_000;

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDistance(au: number, isMoon: boolean): string {
  return isMoon
    ? `${Math.round(au * KM_PER_AU).toLocaleString()} km`
    : `${au.toFixed(au < 10 ? 2 : 1)} AU`;
}

/**
 * State and derived astronomy for one sky. Provided by the sky shell, so all three
 * tabs share it; every value is a lazily evaluated signal.
 */
@Injectable()
export class SkyStateService {
  /** Set by the shell from the URL before any tab renders. */
  readonly query = signal<SkyQuery>({ date: '2000-01-01', time: '00:00', lat: 0, lon: 0, timeZone: 'UTC', place: '' });
  /** Minutes the time scrubber has moved away from the requested time. */
  readonly offsetMinutes = signal(0);
  readonly showLines = signal(true);
  readonly showNames = signal(false);
  readonly showPlanets = signal(true);
  /** Name of the star or body the user tapped. */
  readonly selected = signal<string | null>(null);

  readonly baseDate = computed(() => {
    const q = this.query();
    return zonedTimeToUtc(q.date, q.time, q.timeZone);
  });
  readonly date = computed(() => new Date(this.baseDate().getTime() + this.offsetMinutes() * 60_000));
  readonly time = computed<AstroTime>(() => MakeTime(this.date()));
  readonly observer = computed(() => new Observer(this.query().lat, this.query().lon, 0));

  // ---- Positions

  readonly bodies = computed(() => bodyPositions(this.time(), this.observer()));
  readonly sunAlt = computed(() => this.bodies().find((b) => b.key === 'sun')!.alt);
  readonly phase = computed(() => skyPhase(this.sunAlt()));
  readonly dome = computed(() => domeStops(this.sunAlt()));
  readonly visibleStars = computed(() => projectStars(this.time(), this.observer(), this.sunAlt()));
  /** Drawn faintest first so bright stars sit on top. */
  readonly stars = computed(() => [...this.visibleStars().values()].sort((a, b) => b.mag - a.mag));
  readonly segments = computed(() => constellationSegments(this.visibleStars()));
  readonly labels = computed(() => constellationLabels(this.visibleStars()));
  readonly moon = computed(() => moonInfo(this.time(), this.query().lat));
  readonly planetsUp = computed(() => this.bodies().filter((b) => isPlanet(b.key) && b.up).length);
  /** Sun altitude across the night, for the scrubber; tied to the requested time, not the offset. */
  readonly sunSamples = computed(() => sunAltitudeSamples(this.baseDate(), this.observer()));

  // ---- Text

  formatTime(date: Date | null, withDay = false): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat(undefined, {
      timeZone: this.query().timeZone,
      hour: 'numeric',
      minute: '2-digit',
      ...(withDay ? { weekday: 'short' } : {}),
    }).format(date);
  }

  formatDate(date: Date, style: 'long' | 'medium' = 'long'): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: style, timeZone: this.query().timeZone }).format(date);
  }

  readonly caption = computed(() => {
    const place = this.query().place;
    const date = this.formatDate(this.date());
    const time = this.formatTime(this.date());
    return { place, date, time, text: `The sky over ${place} on ${date} at ${time}.` };
  });

  /** Coordinates line, unless the place name already is the coordinates. */
  readonly coords = computed(() => {
    const coords = formatCoords(this.query().lat, this.query().lon);
    return coords === this.query().place ? null : coords.replace(', ', '  ·  ');
  });

  readonly fileName = computed(() => {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: this.query().timeZone }).format(this.date());
    return `sky-over-${slug(this.query().place) || 'here'}-${day}.png`;
  });

  // ---- Selection

  readonly selectedInfo = computed(() => {
    const name = this.selected();
    if (!name) return null;
    const star = this.visibleStars().get(name);
    if (star) {
      return {
        name,
        kind: 'Star',
        constellation: starConstellation(star),
        mag: star.mag,
        alt: star.alt,
        direction: `${compass(star.az)} · ${Math.round(star.az)}°`,
        x: star.x,
        y: star.y,
      };
    }
    const body = this.bodies().find((b) => b.name === name && b.up);
    if (!body) return null;
    return {
      name,
      kind: isPlanet(body.key) ? 'Planet' : body.key === 'sun' ? 'Star · our own' : 'Natural satellite',
      constellation: bodyConstellation(body.body, this.time(), this.observer()),
      mag: body.mag,
      alt: body.alt,
      direction: `${compass(body.az)} · ${Math.round(body.az)}°`,
      x: body.x,
      y: body.y,
    };
  });

  // ---- Planets tab

  readonly bodyCards = computed(() => {
    const time = this.time();
    const observer = this.observer();
    return this.bodies().map((b) => ({
      ...b,
      direction: `${compass(b.az)} · ${Math.round(b.az)}°`,
      constellation: bodyConstellation(b.body, time, observer),
      events: riseAndSet(b.body, observer, time, b.up),
      distance: formatDistance(b.distanceAu, b.key === 'moon'),
    }));
  });

  // ---- Moon tab

  readonly moonDetails = computed(() => {
    const time = this.time();
    const observer = this.observer();
    const moon = this.bodies().find((b) => b.key === 'moon')!;
    const next = nextFullAndNew(time);
    const tz = this.query().timeZone;
    const week = [-3, -2, -1, 0, 1, 2, 3].map((d) => {
      const date = new Date(this.date().getTime() + d * DAY_MS);
      const fraction = moonIlluminatedFraction(date);
      return {
        offset: d,
        weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: tz }).format(date),
        day: new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: tz }).format(date),
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
    return {
      position: moon,
      events: riseAndSet(moon.body, observer, time, moon.up),
      distance: formatDistance(moon.distanceAu, true),
      constellation: bodyConstellation(moon.body, time, observer),
      nextFull: next.full,
      nextNew: next.new,
      week,
    };
  });
}
