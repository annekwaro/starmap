import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { moonLitPath } from '../astro/astro';

let nextId = 0;

/** Rough positions of the large lunar maria, as seen with the naked eye. */
const MARIA = [
  { cx: -14, cy: -20, r: 11, o: 0.1 }, // Imbrium
  { cx: 6, cy: -16, r: 8, o: 0.09 }, // Serenitatis
  { cx: 20, cy: -6, r: 9, o: 0.1 }, // Tranquillitatis
  { cx: 30, cy: -20, r: 5, o: 0.1 }, // Crisium
  { cx: -28, cy: 2, r: 13, o: 0.08 }, // Procellarum
  { cx: 12, cy: 10, r: 6, o: 0.08 }, // Nectaris
  { cx: -10, cy: 16, r: 8, o: 0.07 }, // Nubium
  { cx: 2, cy: 34, r: 3, o: 0.12 }, // Tycho
];

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
        <filter [attr.id]="softId" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <clipPath [attr.id]="clipId">
          <path [attr.d]="path()" [attr.transform]="mirror() ? 'scale(-1 1)' : null" />
        </clipPath>
      </defs>
      <circle r="48" fill="#1b2235" />
      <!-- Earthshine: the dark limb is faintly lit -->
      <circle r="48" fill="#8a96b8" fill-opacity="0.06" />
      <g [attr.clip-path]="'url(#' + clipId + ')'">
        <circle r="48" [attr.fill]="'url(#' + litId + ')'" />
        <g [attr.filter]="'url(#' + softId + ')'">
          @for (m of maria; track $index) {
            <circle [attr.cx]="m.cx" [attr.cy]="m.cy" [attr.r]="m.r" fill="#5b5440" [attr.fill-opacity]="m.o" />
          }
        </g>
      </g>
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

  private readonly id = nextId++;
  protected readonly litId = `moon-lit-${this.id}`;
  protected readonly clipId = `moon-clip-${this.id}`;
  protected readonly softId = `moon-soft-${this.id}`;
  protected readonly maria = MARIA;
  protected readonly path = computed(() => moonLitPath(this.fraction(), 48));
}
