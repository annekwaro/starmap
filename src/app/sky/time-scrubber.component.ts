import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, model, signal } from '@angular/core';

const SPAN = 720; // minutes either side of the requested time
/** Playback speed: sky minutes per real second. */
const PLAY_RATE = 60;

/**
 * A 24-hour ruler centred on the requested time. The background is shaded by the
 * Sun's altitude so day, twilight and night read at a glance. Interaction is a
 * native range input, so it works with keyboard and assistive tech; a play button
 * sweeps it forward so the sky can be watched turning.
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
  readonly playing = signal(false);
  /** Ruler position under the mouse, 0–100, for the ghost marker. */
  protected readonly ghost = signal<number | null>(null);

  private frame = 0;
  /** Sub-step remainder so playback is smooth at any frame rate. */
  private carry = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  private format(date: Date, opts: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, { timeZone: this.timeZone(), ...opts }).format(date);
  }

  private at(offset: number): Date {
    return new Date(this.baseDate().getTime() + offset * 60_000);
  }

  protected readonly current = computed(() => this.format(this.at(this.offset()), { hour: 'numeric', minute: '2-digit' }));
  protected readonly currentDay = computed(() => this.format(this.at(this.offset()), { weekday: 'long' }));
  protected readonly baseLabel = computed(() => this.format(this.baseDate(), { hour: 'numeric', minute: '2-digit' }));
  protected readonly progress = computed(() => ((this.offset() + SPAN) / (2 * SPAN)) * 100);

  protected readonly ghostLabel = computed(() => {
    const x = this.ghost();
    if (x === null) return null;
    const offset = Math.round(((x / 100) * 2 * SPAN - SPAN) / 5) * 5;
    return this.format(this.at(offset), { hour: 'numeric', minute: '2-digit' });
  });

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
    this.stop();
    this.offset.set(Number(value));
  }

  protected onRulerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.ghost.set(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  }

  protected onRulerLeave(): void {
    this.ghost.set(null);
  }

  // ---- Playback

  toggle(): void {
    if (this.playing()) this.stop();
    else this.play();
  }

  /** Nudge the time by whole minutes, e.g. from a keyboard shortcut. */
  step(minutes: number): void {
    this.stop();
    this.offset.set(Math.min(SPAN, Math.max(-SPAN, this.offset() + minutes)));
  }

  private play(): void {
    if (this.offset() >= SPAN) this.offset.set(-SPAN);
    this.playing.set(true);
    this.carry = 0;
    let last = performance.now();
    const tick = (now: number) => {
      this.carry += ((now - last) / 1000) * PLAY_RATE;
      last = now;
      const whole = Math.floor(this.carry);
      if (whole > 0) {
        this.carry -= whole;
        const next = Math.min(SPAN, this.offset() + whole);
        this.offset.set(next);
        if (next >= SPAN) {
          this.stop();
          return;
        }
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.playing.set(false);
  }
}
