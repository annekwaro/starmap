import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CITIES, MY_LOCATION_OPTION } from '../data/cities';
import { formatCoords } from '../data/format';
import { parseQueryParams, toQueryParams } from '../sky/sky-query';

type GeoStatus = 'idle' | 'locating' | 'error';

const DEFAULT_CITY = CITIES.find((c) => c.name === 'London')!;
const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly router = inject(Router);

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

  constructor() {
    // Coming back from a sky to edit it: start from what was shown.
    const query = parseQueryParams(inject(ActivatedRoute).snapshot.queryParamMap);
    if (!query) return;
    this.selectedDate.set(query.date);
    this.selectedTime.set(query.time);
    this.selectedLat.set(query.lat);
    this.selectedLon.set(query.lon);
    this.selectedPlace.set(query.place);
    this.selectedTimeZone.set(query.timeZone);
    const city = this.cities.find((c) => c.name === query.place);
    if (city) {
      this.locationChoice.set(city.name);
    } else {
      this.locationChoice.set(this.myLocation.value);
      this.geoCoords.set({ lat: query.lat, lon: query.lon });
    }
  }

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
    this.router.navigate(['/sky'], {
      queryParams: toQueryParams({
        date: this.selectedDate(),
        time: this.selectedTime(),
        lat: this.selectedLat(),
        lon: this.selectedLon(),
        timeZone: this.selectedTimeZone(),
        place: this.selectedPlace(),
      }),
    });
  }
}
