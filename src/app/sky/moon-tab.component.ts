import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MoonGlyphComponent } from '../ui/moon-glyph.component';
import { SkyStateService } from './sky-state.service';

const DIAL_R = 124;

@Component({
  selector: 'app-moon-tab',
  imports: [MoonGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moon-tab.component.html',
  styleUrl: './moon-tab.component.scss',
})
export class MoonTabComponent {
  protected readonly state = inject(SkyStateService);
  protected readonly dialR = DIAL_R;

  /** 60 ticks around the dial; every 15th is a long quarter mark. */
  protected readonly ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const major = i % 15 === 0;
    const r1 = major ? 136 : 142;
    const r2 = major ? 154 : 148;
    return { x1: r1 * Math.cos(a), y1: r1 * Math.sin(a), x2: r2 * Math.cos(a), y2: r2 * Math.sin(a), major };
  });

  /** Knob at the end of the illumination arc. */
  protected readonly knob = computed(() => {
    const a = this.state.moon().fraction * 2 * Math.PI - Math.PI / 2;
    return { x: DIAL_R * Math.cos(a), y: DIAL_R * Math.sin(a) };
  });

  protected readonly stats = computed(() => {
    const d = this.state.moonDetails();
    return [
      { label: d.events[0].label === 'Rose' ? 'Moonrise' : 'Moonset', value: this.state.formatTime(d.events[0].date, true) },
      { label: d.events[1].label === 'Sets' ? 'Moonset' : 'Moonrise', value: this.state.formatTime(d.events[1].date, true) },
      { label: 'Distance', value: d.distance },
      { label: 'In', value: d.constellation },
      { label: 'Next full moon', value: this.state.formatDate(d.nextFull, 'medium') },
      { label: 'Next new moon', value: this.state.formatDate(d.nextNew, 'medium') },
    ];
  });
}
