import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { isPlanet } from '../astro/astro';
import { StarMapComponent } from '../star-map/star-map.component';
import { SearchItem, SkySearchComponent } from './sky-search.component';
import { SkyStateService } from './sky-state.service';
import { TimeScrubberComponent } from './time-scrubber.component';

type ExportState = 'idle' | 'busy' | 'error';

/** Minutes per press of the time-step keys. */
const STEP_MINUTES = 10;

@Component({
  selector: 'app-sky-tab',
  imports: [StarMapComponent, TimeScrubberComponent, SkySearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-tab.component.html',
  styleUrl: './sky-tab.component.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class SkyTabComponent {
  protected readonly state = inject(SkyStateService);
  private readonly starMap = viewChild.required(StarMapComponent);
  private readonly scrubber = viewChild.required(TimeScrubberComponent);
  private readonly search = viewChild.required(SkySearchComponent);
  private readonly shortcutsDialog = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');

  protected readonly exportState = signal<ExportState>('idle');

  protected readonly toggles = [
    { label: 'Constellation lines', key: 'L', value: this.state.showLines },
    { label: 'Names', key: 'N', value: this.state.showNames },
    { label: 'Sun, Moon & planets', key: 'P', value: this.state.showPlanets },
  ];

  protected readonly shortcuts = [
    { keys: ['/'], label: 'Find a star or planet' },
    { keys: ['Space'], label: 'Play or pause the night' },
    { keys: [',', '.'], label: `Step time back or forward ${STEP_MINUTES} min` },
    { keys: ['+', '−'], label: 'Zoom in or out' },
    { keys: ['0'], label: 'Show the whole sky' },
    { keys: ['L', 'N', 'P'], label: 'Toggle lines, names, planets' },
    { keys: ['Esc'], label: 'Clear the selection' },
    { keys: ['?'], label: 'Show these shortcuts' },
  ];

  protected readonly searchItems = computed<SearchItem[]>(() => [
    ...this.state.bodies()
      .filter((b) => b.up)
      .map((b) => ({ name: b.name, kind: isPlanet(b.key) ? 'Planet' : b.key === 'sun' ? 'Sun' : 'Moon', color: b.color, mag: b.mag })),
    ...this.state.stars().map((s) => ({ name: s.name, kind: 'Star', color: s.color ?? '#fff', mag: s.mag })),
  ]);

  /** Wrapped in an array so each new selection re-renders, replaying the entrance. */
  protected readonly selection = computed(() => {
    const info = this.state.selectedInfo();
    return info ? [info] : [];
  });

  protected flyTo(name: string): void {
    this.state.selected.set(name);
    const info = this.state.selectedInfo();
    if (info) this.starMap().focus(info);
  }

  protected openShortcuts(): void {
    this.shortcutsDialog().nativeElement.showModal();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable], dialog')) return;

    const map = this.starMap();
    const actions: Record<string, () => void> = {
      '/': () => this.search().focus(),
      ',': () => this.scrubber().step(-STEP_MINUTES),
      '.': () => this.scrubber().step(STEP_MINUTES),
      '+': () => map.zoomBy(1.6),
      '=': () => map.zoomBy(1.6),
      '-': () => map.zoomBy(1 / 1.6),
      '0': () => map.resetView(),
      l: () => this.state.showLines.update((v) => !v),
      n: () => this.state.showNames.update((v) => !v),
      p: () => this.state.showPlanets.update((v) => !v),
      Escape: () => this.state.selected.set(null),
      '?': () => this.openShortcuts(),
    };
    // Space on a focused button should press that button.
    if (event.key === ' ' && !target.closest('button, a')) {
      event.preventDefault();
      this.scrubber().toggle();
      return;
    }
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

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
