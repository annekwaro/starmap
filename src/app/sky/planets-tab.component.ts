import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoonGlyphComponent } from '../ui/moon-glyph.component';
import { SkyStateService } from './sky-state.service';

@Component({
  selector: 'app-planets-tab',
  imports: [MoonGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planets-tab.component.html',
  styleUrl: './planets-tab.component.scss',
})
export class PlanetsTabComponent {
  protected readonly state = inject(SkyStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Sphere centre in the horizon window, in %. The horizon is the middle; a body
   * that is up sits wholly above it and climbs with altitude, one that is down
   * sits wholly below it and sinks with depth.
   */
  protected spherePosition(alt: number): number {
    const clearance = 17; // sphere radius as % of the window height
    return alt > 0 ? 50 - clearance - (alt / 90) * 20 : 50 + clearance + (-alt / 90) * 18;
  }

  protected showOnMap(name: string): void {
    this.state.selected.set(name);
    this.router.navigate(['..'], { relativeTo: this.route, queryParamsHandling: 'preserve' });
  }
}
