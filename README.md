# The Sky on the Night You Were Born

A minimalist star map generator. Pick a date, a time and a place, and see the sky that was
overhead: bright stars, constellation figures and the phase of the Moon. You can save the
result as a 4:5 poster PNG.

Everything runs in the browser. There is no backend and there are no external APIs. The
only browser API it uses beyond the basics is optional Geolocation.

## Run it locally

Requires Node.js 18.19+, 20.11+ or 22+.

```bash
npm install
npx ng serve        # http://localhost:4200
npx ng build        # production build in dist/star-map
```

## Stack

- **Angular 19**: standalone components, signals, `OnPush` everywhere
- **[astronomy-engine](https://github.com/cosinekitty/astronomy)**: all astronomical math
- **Pure SVG** for rendering (no D3, no charting libraries)
- **html2canvas** for PNG export (lazy-loaded on first export)

## How the math works

1. **Local time to UTC.** A birth time is local to the place where it happened, so each
   city carries an IANA time zone. `zonedTimeToUtc` (`src/app/data/zoned-time.ts`) turns
   the wall-clock time into a UTC instant using the browser's built-in `Intl` time-zone
   data, which handles daylight saving and historical offsets. "Use my location" uses the
   browser's own time zone.
2. **Precession.** Star coordinates are stored at the J2000 epoch. Each one becomes a unit
   vector, which is rotated to the equator and equinox of the chosen date
   (`Rotation_EQJ_EQD`). That matters for dates far from 2000.
3. **Equatorial to horizontal.** `Horizon()` converts right ascension and declination to
   altitude and azimuth for the observer's latitude and longitude, including atmospheric
   refraction. Anything with altitude < 0° is below the horizon and is dropped.
4. **Stereographic projection.** The zenith sits at the centre and the horizon on the rim:

   ```
   r = R · tan((90° − altitude) / 2)
   x = cx − r · sin(azimuth)
   y = cy − r · cos(azimuth)
   ```

   North is up and east is on the **left**, as on any chart you hold overhead and look up
   at. Stereographic projection preserves shapes locally, so constellations keep their
   familiar look.
5. **Constellations.** Fifteen figures (Orion, Ursa Major and Minor, Cassiopeia, Cygnus,
   Lyra, Aquila, Scorpius, Crux, Leo, Gemini, Taurus, Canis Major, Pegasus, Andromeda) are
   defined as polylines through named stars. A segment is drawn only when both of its
   endpoints are above the horizon.
6. **Moon phase.** `MoonPhase()` gives the Sun–Moon elongation (0° new, 180° full), and
   `Illumination(Body.Moon).phase_fraction` gives the lit fraction *f*. The lit shape is a
   semicircle closed by a half-ellipse terminator with horizontal radius `R·|1 − 2f|`.
   Waxing moons are lit on the right as seen from the northern hemisphere. The drawing is
   mirrored for waning phases and for southern-hemisphere observers.
7. **Star size.** Radius and opacity scale gently with apparent magnitude. A few well-known
   stars get a subtle tint that hints at their colour (Betelgeuse, Antares and Aldebaran
   warm; Rigel, Spica and Vega cool).

## Project layout

```
src/app/
  data/
    stars.ts            ~120 stars: the brightest, plus fainter ones that complete figures
    constellations.ts   constellation polylines by star name
    cities.ts           50 cities with lat/lon and IANA time zone
    zoned-time.ts       local wall-clock time to UTC via Intl
    format.ts           coordinate formatting
  landing/              input card, form state signals, reveal/back transition
  star-map/             projection, constellations, moon, caption, PNG export
```

## Notes

- **Motion.** Stars ripple in from the zenith, constellation lines draw themselves
  (`stroke-dasharray` on `pathLength="1"`), and the screens cross-fade. All of it is CSS,
  and all of it is turned off under `prefers-reduced-motion: reduce`.
- **Export.** html2canvas serialises inline SVG into an image, which drops stylesheet
  rules. That's why colours inside the map SVG are presentation attributes. It also copies
  computed styles inline onto its clone, so the fixed 1080×1350 poster layout is applied
  as inline styles in `onclone`. The download is 2160×2700 px.
- **Accuracy.** This is a poster, not a planetarium. Positions are accurate to well under
  a degree, which is far finer than the drawing can show. Planets are not shown.
