# ADR 006: Ephemeris provider abstraction with VSOP87D as the default

- **Status:** Accepted
- **Date:** 2026-03-29

## Context

The original simulation computed heliocentric body positions with a single
low-precision J2000 Keplerian element series (ADR 002).  This was fast and
sufficient for an early prototype, but had documented weaknesses:

- Errors of 1–2° of arc for outer planets (Jupiter, Saturn, Uranus, Neptune)
  because Keplerian elements ignore mutual gravitational perturbations between
  planets.
- No abstraction — all callers imported the concrete implementation directly
  from `orbital-mechanics.ts`, making it impossible to swap or test alternative
  sources without touching many files.

The roadmap issue "Upgrade orbital calculations to high-fidelity ephemerides"
required both an accuracy improvement and a path for future upgrades.

## Decision

### 1. Introduce an `EphemerisProvider` interface (`src/ephemeris/provider.ts`)

The interface defines two operations every provider must support:

```ts
interface EphemerisProvider {
  readonly label: string
  getHeliocentricPositionAu(body: SolarBodyDefinition, date: Date): Vector3
  buildOrbitPoints(body: SolarBodyDefinition, date: Date, samples?: number): Vector3[]
}
```

All heliocentric position calculations anywhere in the codebase go through
this interface.

### 2. Retain the Keplerian implementation as an explicit approximation fallback

`KeplerianEphemerisProvider` (`src/ephemeris/keplerian.ts`) is the direct
successor to the original code.  Its `label` property reads
`"Keplerian (approximation)"` so that any debugging output or future UI that
exposes the active provider makes the approximation nature obvious.

It is still used as the fallback for Pluto, which is not covered by VSOP87.

### 3. Add a VSOP87D truncated provider as the new default

`Vsop87EphemerisProvider` (`src/ephemeris/vsop87.ts`) implements the truncated
VSOP87D theory (Bretagnon & Francou, A&A 202, 1988).  The coefficient tables
are stored in `src/ephemeris/vsop87-coefficients.ts`.

**Algorithm summary:**

- Input: body name, JavaScript `Date`
- Compute τ = Julian millennia from J2000.0 = (JD − 2 451 545) / 365 250
- For each body, evaluate three power series L(τ), B(τ), R(τ):
  - L = heliocentric ecliptic longitude (radians)
  - B = heliocentric ecliptic latitude  (radians)
  - R = heliocentric distance (AU)
- Each power series: Lₙ = Σᵢ Aᵢ · cos(Bᵢ + Cᵢ · τ), scaled by 10⁻⁸
- Convert to J2000 ecliptic Cartesian, then map to Three.js Y-up:
  - Three.js X = R · cos(B) · cos(L)  (towards vernal equinox)
  - Three.js Y = R · sin(B)            (north ecliptic pole)
  - Three.js Z = R · cos(B) · sin(L)  (90° east in ecliptic plane)

**Coverage:** Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.
Pluto falls back to `KeplerianEphemerisProvider` (this fallback path is
explicit in code and documented here).

**Truncation:** Terms with amplitude ≥ 10 × 10⁻⁸ are retained, giving
positional accuracy better than 1 arc-minute within ±500 years of J2000.
This is a significant improvement over the Keplerian approach which can err by
1–2° of arc for outer planets.

### 4. Keep `orbital-mechanics.ts` as a backward-compatible facade

The public functions `getHeliocentricPositionAu` and `buildOrbitPoints` still
exist with unchanged signatures; they now delegate to the default provider
(`Vsop87EphemerisProvider`).  Existing callers (e.g. `SolarBodies.tsx`,
`SimulatorCanvas.tsx`) required no changes.

### 5. Validate against known reference positions in tests

`tests/unit/vsop87.test.ts` validates:

- Earth at J2000.0: radius ≈ 0.983 AU (consistent with perihelion on January 3)
- Earth at simulation start: radius in [0.985, 1.005] AU
- Mars near J2000.0: radius in [1.38, 1.67] AU
- Jupiter near J2000.0: radius in [4.95, 5.46] AU
- Saturn near J2000.0: radius in [9.0, 10.1] AU
- Pluto delegates to Keplerian (positions are identical)
- All eight covered planets return finite, non-zero radii
- `buildOrbitPoints` returns the correct number of samples for both paths

## Consequences

### Positive

- Positional accuracy improves from ~1–2° to < 1 arc-minute for the eight
  major planets within the game's simulated date range.
- The `EphemerisProvider` interface makes future upgrades (e.g. adding a
  full-precision VSOP87 or a DE440 lookup) a localised change with no
  impact on rendering or physics code.
- The Keplerian approximation is explicit (labelled, documented, used only for
  Pluto) rather than the hidden default.
- The VSOP87 coefficient tables are in a single file; adding or removing a
  planet is a data change, not an algorithm change.

### Negative

- The coefficient table (`vsop87-coefficients.ts`) is large (~500 lines of
  float data) and difficult to audit manually.
- `buildOrbitPoints` for VSOP87 bodies advances time in period/samples steps;
  this produces a closed orbit shape but is slightly slower than the Keplerian
  analytic sampling.
- Pluto remains on the Keplerian path because VSOP87 does not extend to Pluto.

## Approximation Fallbacks — Explicit Summary

| Body   | Provider              | Accuracy    |
|--------|-----------------------|-------------|
| Mercury–Neptune | VSOP87D truncated | < 1 arcmin within ±500 yr of J2000 |
| Pluto  | Keplerian (approximation) | ~1–2° errors over the simulation range |

These assignments are enforced at runtime: `Vsop87EphemerisProvider.getHeliocentricPositionAu`
checks whether the body name is present in `VSOP87_COEFFICIENTS` and explicitly
delegates to `KeplerianEphemerisProvider` for absent bodies.

## References

- Bretagnon P. & Francou G. (1988). *Planetary theories in rectangular and
  spherical variables: VSOP 87 solutions.* A&A 202, 309–315.
- Meeus J. (1998). *Astronomical Algorithms*, 2nd ed. Willmann-Bell. Chapters
  32–33 (truncated VSOP87 tables and algorithm).
- Standish et al. (1992). *Orbital Ephemerides of the Sun, Moon, and Planets.*
  Explanatory Supplement to the Astronomical Almanac (Keplerian element source
  for the fallback provider).
