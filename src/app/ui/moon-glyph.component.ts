import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { moonLitPath } from '../astro/astro';

let nextId = 0;

/** A self-contained SVG moon showing the given illuminated fraction. */
@Component({
  selector: 'app-moon-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="-50 -50 100 100" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <defs>
        <radialGradient [attr.id]="litId" gradientUnits="userSpaceOnUse" cx="-14" cy="-18" r="78">
          <stop offset="0%" stop-color="#fbf7ec" />
          <stop offset="100%" stop-color="#cfc5ab" />
        </radialGradient>
      </defs>
      <circle r="48" fill="#1b2235" />
      <path [attr.d]="path()" [attr.fill]="'url(#' + litId + ')'" [attr.transform]="mirror() ? 'scale(-1 1)' : null" />
      <circle r="48" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
  `,
})
export class MoonGlyphComponent {
  readonly fraction = input.required<number>();
  readonly mirror = input(false);
  readonly size = input(48);

  protected readonly litId = `moon-lit-${nextId++}`;
  protected readonly path = computed(() => moonLitPath(this.fraction(), 48));
}
