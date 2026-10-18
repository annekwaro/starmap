import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { StarMapComponent } from '../star-map/star-map.component';
import { SkyStateService } from './sky-state.service';
import { TimeScrubberComponent } from './time-scrubber.component';

type ExportState = 'idle' | 'busy' | 'error';

@Component({
  selector: 'app-sky-tab',
  imports: [StarMapComponent, TimeScrubberComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-tab.component.html',
  styleUrl: './sky-tab.component.scss',
})
export class SkyTabComponent {
  protected readonly state = inject(SkyStateService);
  private readonly starMap = viewChild.required(StarMapComponent);

  protected readonly exportState = signal<ExportState>('idle');

  protected readonly toggles = [
    { label: 'Constellation lines', value: this.state.showLines },
    { label: 'Names', value: this.state.showNames },
    { label: 'Sun, Moon & planets', value: this.state.showPlanets },
  ];

  protected async exportPng(): Promise<void> {
    if (this.exportState() === 'busy') return;
    this.exportState.set('busy');
    try {
      await this.starMap().exportPng();
      this.exportState.set('idle');
    } catch (error) {
      console.error('PNG export failed', error);
      this.exportState.set('error');
    }
  }
}
