import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

const SPAN = 720; // minutes either side of the requested time

/**
 * A 24-hour ruler centred on the requested time. The background is shaded by the
 * Sun's altitude so day, twilight and night read at a glance. Interaction is a
 * native range input, so it works with keyboard and assistive tech.
 */
@Component({
  selector: 'app-time-scrubber',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-scrubber.component.html',
  styleUrl: './time-scrubber.component.scss',
})
export class TimeScrubberComponent {
  readonly baseDate = input.required<Date>();
  readonly timeZone = input.required<string>();
  readonly samples = input.required<{ offset: number; alt: number }[]>();
  readonly offset = model(0);

  protected readonly span = SPAN;

  private format(date: Date, opts: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, { timeZone: this.timeZone(), ...opts }).format(date);
  }

  private at(offset: number): Date {
    return new Date(this.baseDate().getTime() + offset * 60_000);
  }

  protected readonly current = computed(() => this.format(this.at(this.offset()), { hour: 'numeric', minute: '2-digit' }));
  protected readonly currentDay = computed(() => this.format(this.at(this.offset()), { weekday: 'long' }));
  protected readonly baseLabel = computed(() => this.format(this.baseDate(), { hour: 'numeric', minute: '2-digit' }));

  protected readonly relative = computed(() => {
    const m = this.offset();
    if (m === 0) return 'Requested time';
    const h = Math.floor(Math.abs(m) / 60);
    const min = Math.abs(m) % 60;
    return `${m > 0 ? '+' : '−'}${h ? `${h}h ` : ''}${min ? `${min}m` : ''}`.trim();
  });

  /** Gold where the Sun is up, fading through twilight to clear at night. */
  protected readonly daylightGradient = computed(() => {
    const stops = this.samples().map(({ offset, alt }) => {
      const t = Math.min(1, Math.max(0, (alt + 18) / 18));
      const pct = ((offset + SPAN) / (2 * SPAN)) * 100;
      return `rgb(242 196 109 / ${(0.03 + 0.3 * t * t).toFixed(3)}) ${pct.toFixed(2)}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  });

  /** Ticks every 30 minutes of local clock time, with labels every 3 hours. */
  protected readonly ticks = computed(() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone(),
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(this.baseDate());
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const baseMinutes = get('hour') * 60 + get('minute');

    const ticks: { x: number; major: boolean; label: string | null }[] = [];
    for (let m = -SPAN; m <= SPAN; m++) {
      const local = (((baseMinutes + m) % 1440) + 1440) % 1440;
      if (local % 30 !== 0) continue;
      const major = local % 180 === 0;
      ticks.push({
        x: ((m + SPAN) / (2 * SPAN)) * 100,
        major,
        label: major ? this.format(this.at(m), { hour: 'numeric' }) : null,
      });
    }
    return ticks;
  });

  /** Sunset and sunrise, found where the Sun's altitude crosses the horizon. */
  protected readonly sunEvents = computed(() => {
    const samples = this.samples();
    const events: { x: number; label: string; rising: boolean }[] = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const h = -0.833;
      if ((a.alt - h) * (b.alt - h) > 0) continue;
      const offset = a.offset + ((h - a.alt) / (b.alt - a.alt)) * (b.offset - a.offset);
      const rising = b.alt > a.alt;
      events.push({
        x: ((offset + SPAN) / (2 * SPAN)) * 100,
        rising,
        label: `${rising ? 'Sunrise' : 'Sunset'} ${this.format(this.at(offset), { hour: 'numeric', minute: '2-digit' })}`,
      });
    }
    return events;
  });

  protected onInput(value: string): void {
    this.offset.set(Number(value));
  }
}
