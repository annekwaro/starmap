import { ParamMap, Params } from '@angular/router';
import { formatCoords } from '../data/format';

/** Everything needed to reproduce a sky; serialised into the URL so links are shareable. */
export interface SkyQuery {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local wall-clock time, HH:mm. */
  time: string;
  lat: number;
  lon: number;
  timeZone: string;
  place: string;
}

export function toQueryParams(q: SkyQuery): Params {
  return {
    d: q.date,
    t: q.time,
    lat: q.lat.toFixed(4),
    lon: q.lon.toFixed(4),
    tz: q.timeZone,
    place: q.place,
  };
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Parses and validates URL query params; returns null if anything is missing or malformed. */
export function parseQueryParams(params: ParamMap): SkyQuery | null {
  const date = params.get('d') ?? '';
  const time = params.get('t') ?? '';
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const timeZone = params.get('tz') ?? '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  if (!params.has('lat') || !params.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || !isTimeZone(timeZone)) return null;

  return { date, time, lat, lon, timeZone, place: params.get('place')?.trim() || formatCoords(lat, lon) };
}
