import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { CITIES, MY_LOCATION_OPTION } from '../data/cities';
import { formatCoords } from '../data/format';
import { zonedTimeToUtc } from '../data/zoned-time';
import { StarMapComponent } from '../star-map/star-map.component';

type GeoStatus = 'idle' | 'locating' | 'error';

interface SkyRequest {
  lat: number;
  lon: number;
  date: Date;
  timeZone: string;
  place: string;
}

const DEFAULT_CITY = CITIES.find((c) => c.name === 'London')!;
const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

@Component({
  selector: 'app-landing',
  imports: [StarMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly injector = inject(Injector);
  private readonly revealButton = viewChild.required<ElementRef<HTMLButtonElement>>('revealButton');
  private readonly starMap = viewChild(StarMapComponent);

  readonly cities = CITIES;
  readonly myLocation = MY_LOCATION_OPTION;

  // Form state
  readonly selectedDate = signal(todayIso());
  readonly selectedTime = signal('21:00');
  readonly selectedLat = signal(DEFAULT_CITY.lat);
  readonly selectedLon = signal(DEFAULT_CITY.lon);
  readonly selectedPlace = signal(DEFAULT_CITY.name);
  readonly selectedTimeZone = signal(DEFAULT_CITY.timeZone);
  /** Current dropdown value: a city name or the my-location sentinel. */
  readonly locationChoice = signal<string>(DEFAULT_CITY.name);

  // Geolocation state
  readonly geoStatus = signal<GeoStatus>('idle');
  readonly geoError = signal('');
  readonly geoCoords = signal<{ lat: number; lon: number } | null>(null);

  // View state
  readonly sky = signal<SkyRequest | null>(null);
  /**
   * The current request as a one-item list. Rendering it with @for keyed by object
   * identity re-creates the map on every reveal, so its entrance animation replays.
   */
  readonly skyView = computed(() => {
    const sky = this.sky();
    return sky ? [sky] : [];
  });
  readonly showSky = signal(false);

  readonly myLocationLabel = computed(() => {
    const coords = this.geoCoords();
    return coords ? `My location (${formatCoords(coords.lat, coords.lon)})` : this.myLocation.label;
  });

  readonly locationHint = computed(() => {
    switch (this.geoStatus()) {
      case 'locating':
        return 'Finding your location…';
      case 'error':
        return this.geoError();
      default:
        return this.locationChoice() === this.myLocation.value
          ? `Time is in your current time zone (${this.selectedTimeZone().replace(/_/g, ' ')}).`
          : `Time is local to ${this.selectedPlace()}.`;
    }
  });

  readonly canReveal = computed(
    () => !!this.selectedDate() && !!this.selectedTime() && this.geoStatus() !== 'locating',
  );

  onLocationChange(value: string): void {
    if (value === this.myLocation.value) {
      this.useMyLocation();
      return;
    }
    const city = this.cities.find((c) => c.name === value);
    if (!city) return;
    this.locationChoice.set(city.name);
    this.selectedLat.set(city.lat);
    this.selectedLon.set(city.lon);
    this.selectedPlace.set(city.name);
    this.selectedTimeZone.set(city.timeZone);
    this.geoStatus.set('idle');
  }

  useMyLocation(): void {
    const previousChoice = this.locationChoice();
    const fail = (message: string) => {
      // Restore the dropdown to whatever was selected before.
      this.locationChoice.set(previousChoice);
      this.geoError.set(message);
      this.geoStatus.set('error');
    };

    if (!('geolocation' in navigator)) {
      fail('This browser can’t share its location. Please choose a city.');
      return;
    }

    this.locationChoice.set(this.myLocation.value);
    this.geoStatus.set('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.geoCoords.set({ lat: coords.latitude, lon: coords.longitude });
        this.selectedLat.set(coords.latitude);
        this.selectedLon.set(coords.longitude);
        this.selectedPlace.set(formatCoords(coords.latitude, coords.longitude));
        this.selectedTimeZone.set(BROWSER_TIME_ZONE);
        this.geoStatus.set('idle');
      },
      (error) => {
        fail(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Please choose a city.'
            : 'Your location couldn’t be found. Please choose a city.',
        );
      },
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  reveal(event: Event): void {
    event.preventDefault();
    if (!this.canReveal()) return;

    this.sky.set({
      lat: this.selectedLat(),
      lon: this.selectedLon(),
      date: zonedTimeToUtc(this.selectedDate(), this.selectedTime(), this.selectedTimeZone()),
      timeZone: this.selectedTimeZone(),
      place: this.selectedPlace(),
    });
    this.showSky.set(true);
    afterNextRender(() => this.starMap()?.focusBack(), { injector: this.injector });
  }

  hideSky(): void {
    this.showSky.set(false);
    afterNextRender(() => this.revealButton().nativeElement.focus(), { injector: this.injector });
  }
}
