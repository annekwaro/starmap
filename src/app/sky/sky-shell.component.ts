import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, IsActiveMatchOptions, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { parseQueryParams, toQueryParams } from './sky-query';
import { SkyStateService } from './sky-state.service';

type CopyState = 'idle' | 'copied' | 'failed';

const EXACT: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
const SUBSET: IsActiveMatchOptions = { ...EXACT, paths: 'subset' };

/** Frame for the three sky tabs; owns the shared state, read from the URL. */
@Component({
  selector: 'app-sky-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  providers: [SkyStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-shell.component.html',
  styleUrl: './sky-shell.component.scss',
})
export class SkyShellComponent {
  protected readonly state = inject(SkyStateService);
  private readonly router = inject(Router);

  protected readonly ready = signal(false);
  protected readonly copyState = signal<CopyState>('idle');
  protected readonly editParams = computed(() => toQueryParams(this.state.query()));
  /** Position of the sliding pill behind the active tab. */
  protected readonly indicator = signal<{ left: number; width: number } | null>(null);

  private activeTab: HTMLElement | null = null;
  /** Re-measures when a tab changes size, e.g. when the planets badge appears. */
  private readonly resizeObserver = new ResizeObserver(() => this.measureActive());

  protected readonly tabs = [
    { path: '.', label: 'Sky', match: EXACT, icon: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z' },
    { path: 'planets', label: 'Planets', match: SUBSET, icon: 'M12 7a5 5 0 100 10 5 5 0 000-10zM3 14.5c1.5 1.8 6 2.8 10.5 1.6S20.6 12.4 21 10' },
    { path: 'moon', label: 'Moon', match: SUBSET, icon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z' },
  ];

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const query = parseQueryParams(params);
        if (!query) {
          this.router.navigate(['/']);
          return;
        }
        if (JSON.stringify(query) !== JSON.stringify(this.state.query())) this.state.query.set(query);
        this.ready.set(true);
      });
    inject(DestroyRef).onDestroy(() => this.resizeObserver.disconnect());
  }

  protected trackActive(tab: HTMLElement): void {
    this.activeTab = tab;
    for (const el of tab.parentElement?.querySelectorAll('.tab') ?? []) this.resizeObserver.observe(el);
    requestAnimationFrame(() => this.measureActive());
  }

  private measureActive(): void {
    const tab = this.activeTab;
    if (tab?.isConnected) this.indicator.set({ left: tab.offsetLeft, width: tab.offsetWidth });
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
    setTimeout(() => this.copyState.set('idle'), 2000);
  }
}
