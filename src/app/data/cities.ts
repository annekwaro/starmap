export interface City {
  name: string;
  lat: number;
  lon: number;
  /** IANA time zone, so a typed local time can be converted to UTC. */
  timeZone: string;
}

/** Sentinel dropdown option that triggers browser geolocation. */
export const MY_LOCATION_OPTION = { value: '__my-location__', label: 'Use my location' } as const;

export const CITIES: City[] = [
  { name: 'Addis Ababa', lat: 9.03, lon: 38.74, timeZone: 'Africa/Addis_Ababa' },
  { name: 'Anchorage', lat: 61.2181, lon: -149.9003, timeZone: 'America/Anchorage' },
  { name: 'Athens', lat: 37.9838, lon: 23.7275, timeZone: 'Europe/Athens' },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633, timeZone: 'Pacific/Auckland' },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018, timeZone: 'Asia/Bangkok' },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074, timeZone: 'Asia/Shanghai' },
  { name: 'Berlin', lat: 52.52, lon: 13.405, timeZone: 'Europe/Berlin' },
  { name: 'Bogotá', lat: 4.711, lon: -74.0721, timeZone: 'America/Bogota' },
  { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, timeZone: 'America/Argentina/Buenos_Aires' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, timeZone: 'Africa/Cairo' },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241, timeZone: 'Africa/Johannesburg' },
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898, timeZone: 'Africa/Casablanca' },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, timeZone: 'America/Chicago' },
  { name: 'Delhi', lat: 28.6139, lon: 77.209, timeZone: 'Asia/Kolkata' },
  { name: 'Denver', lat: 39.7392, lon: -104.9903, timeZone: 'America/Denver' },
  { name: 'Dhaka', lat: 23.8103, lon: 90.4125, timeZone: 'Asia/Dhaka' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, timeZone: 'Asia/Dubai' },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694, timeZone: 'Asia/Hong_Kong' },
  { name: 'Honolulu', lat: 21.3069, lon: -157.8583, timeZone: 'Pacific/Honolulu' },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784, timeZone: 'Europe/Istanbul' },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456, timeZone: 'Asia/Jakarta' },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473, timeZone: 'Africa/Johannesburg' },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011, timeZone: 'Asia/Karachi' },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792, timeZone: 'Africa/Lagos' },
  { name: 'Lima', lat: -12.0464, lon: -77.0428, timeZone: 'America/Lima' },
  { name: 'Lisbon', lat: 38.7223, lon: -9.1393, timeZone: 'Europe/Lisbon' },
  { name: 'London', lat: 51.5074, lon: -0.1278, timeZone: 'Europe/London' },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, timeZone: 'America/Los_Angeles' },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038, timeZone: 'Europe/Madrid' },
  { name: 'Manila', lat: 14.5995, lon: 120.9842, timeZone: 'Asia/Manila' },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332, timeZone: 'America/Mexico_City' },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173, timeZone: 'Europe/Moscow' },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777, timeZone: 'Asia/Kolkata' },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219, timeZone: 'Africa/Nairobi' },
  { name: 'New York', lat: 40.7128, lon: -74.006, timeZone: 'America/New_York' },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, timeZone: 'Europe/Paris' },
  { name: 'Perth', lat: -31.9505, lon: 115.8605, timeZone: 'Australia/Perth' },
  { name: 'Reykjavík', lat: 64.1466, lon: -21.9426, timeZone: 'Atlantic/Reykjavik' },
  { name: 'Rome', lat: 41.9028, lon: 12.4964, timeZone: 'Europe/Rome' },
  { name: 'Santiago', lat: -33.4489, lon: -70.6693, timeZone: 'America/Santiago' },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, timeZone: 'America/Sao_Paulo' },
  { name: 'Seoul', lat: 37.5665, lon: 126.978, timeZone: 'Asia/Seoul' },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737, timeZone: 'Asia/Shanghai' },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198, timeZone: 'Asia/Singapore' },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686, timeZone: 'Europe/Stockholm' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, timeZone: 'Australia/Sydney' },
  { name: 'Tehran', lat: 35.6892, lon: 51.389, timeZone: 'Asia/Tehran' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, timeZone: 'Asia/Tokyo' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, timeZone: 'America/Toronto' },
  { name: 'Vancouver', lat: 49.2827, lon: -123.1207, timeZone: 'America/Vancouver' },
];
