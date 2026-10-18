/** UTC milliseconds for the given calendar fields; safe for years 0–99 too. */
function utcMs(year: number, month: number, day: number, hour: number, minute: number, second = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds. */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = utcMs(get('year'), get('month'), get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * Converts a wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in an IANA time zone
 * to the corresponding UTC instant, using only the browser's built-in Intl data.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = utcMs(year, month, day, hour, minute);

  // The offset depends on the instant, so guess once and correct across DST changes.
  let utc = wall - zoneOffsetMs(wall, timeZone);
  const corrected = zoneOffsetMs(utc, timeZone);
  if (corrected !== wall - utc) {
    utc = wall - corrected;
  }
  return new Date(utc);
}
