/**
 * Public API for the ephemeris subsystem.
 *
 * The default export is the highest-fidelity provider available:
 * `Vsop87EphemerisProvider`, which falls back to `KeplerianEphemerisProvider`
 * for bodies not covered by VSOP87 (e.g. Pluto).
 *
 * Consumers that need a specific provider can import it directly:
 *   import { KeplerianEphemerisProvider } from './ephemeris/keplerian'
 *   import { Vsop87EphemerisProvider }    from './ephemeris/vsop87'
 */
export type { EphemerisProvider } from './provider'
export { KeplerianEphemerisProvider } from './keplerian'
export { Vsop87EphemerisProvider } from './vsop87'

import { Vsop87EphemerisProvider } from './vsop87'

/**
 * The shared default provider used by `orbital-mechanics.ts` and any other
 * code that calls `getHeliocentricPositionAu` / `buildOrbitPoints` without
 * explicitly choosing a provider.
 */
export const defaultEphemerisProvider = new Vsop87EphemerisProvider()
