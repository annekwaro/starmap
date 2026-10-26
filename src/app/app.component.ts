import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StarfieldComponent } from './ui/starfield.component';

/** Elements that get a cursor-tracking light (see `.card` in styles.scss). */
const LIT = '.card, .lit';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, StarfieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-starfield /><router-outlet />`,
})
export class AppComponent {
  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);

    // One delegated listener feeds the pointer position, relative to the card
    // under it, into CSS. Outside Angular: it only writes custom properties.
    afterNextRender(() =>
      zone.runOutsideAngular(() => {
        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== 'mouse') return;
          const el = (event.target as Element | null)?.closest<HTMLElement>(LIT);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          el.style.setProperty('--mx', `${x}px`);
          el.style.setProperty('--my', `${y}px`);
          // -0.5…0.5 across the element, for tilt effects.
          el.style.setProperty('--px', (x / rect.width - 0.5).toFixed(3));
          el.style.setProperty('--py', (y / rect.height - 0.5).toFixed(3));
        };
        document.addEventListener('pointermove', onMove, { passive: true });
        destroyRef.onDestroy(() => document.removeEventListener('pointermove', onMove));
      }),
    );
  }
}
