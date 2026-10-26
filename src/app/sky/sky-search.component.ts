import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

export interface SearchItem {
  name: string;
  kind: string;
  color: string;
  mag: number;
}

const MAX_RESULTS = 7;

/** Type-ahead over everything above the horizon; picking one flies the map to it. */
@Component({
  selector: 'app-sky-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-search.component.html',
  styleUrl: './sky-search.component.scss',
})
export class SkySearchComponent {
  readonly items = input.required<SearchItem[]>();
  readonly picked = output<string>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);

  /** Brightest first; names that start with the query beat ones that merely contain it. */
  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const items = [...this.items()].sort((a, b) => a.mag - b.mag);
    if (!q) return items.slice(0, MAX_RESULTS);
    const starts = items.filter((i) => i.name.toLowerCase().startsWith(q));
    const contains = items.filter((i) => !i.name.toLowerCase().startsWith(q) && i.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  });

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.active.set(count ? (this.active() + 1) % count : 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(count ? (this.active() - 1 + count) % count : 0);
        break;
      case 'Enter': {
        const item = this.results()[this.active()];
        if (this.open() && item) {
          event.preventDefault();
          this.choose(item.name);
        }
        break;
      }
      case 'Escape':
        event.stopPropagation();
        if (this.open()) this.open.set(false);
        else this.field().nativeElement.blur();
        break;
    }
  }

  protected choose(name: string): void {
    this.picked.emit(name);
    this.query.set('');
    this.open.set(false);
    this.field().nativeElement.blur();
  }

  /** Delay so a click on an option lands before the list closes. */
  protected onBlur(): void {
    setTimeout(() => this.open.set(false), 120);
  }

  /** Splits a name around the matched text so it can be emphasised. */
  protected parts(name: string): [string, string, string] {
    const q = this.query().trim();
    const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
    return i < 0 ? [name, '', ''] : [name.slice(0, i), name.slice(i, i + q.length), name.slice(i + q.length)];
  }
}
