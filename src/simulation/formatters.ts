import { ASTRONOMICAL_UNIT_KM } from '../solar-data'

export function formatDistanceAu(distanceAu: number): string {
  if (distanceAu >= 1) {
    return `${distanceAu.toFixed(2)} AU`
  }

  return `${((distanceAu * ASTRONOMICAL_UNIT_KM) / 1_000_000).toFixed(2)} million km`
}

export function formatShipSpeedKmPerSecond(speedKmPerSecond: number): string {
  return `${speedKmPerSecond.toFixed(speedKmPerSecond >= 1000 ? 0 : 1)} km/s`
}

export function formatTimeWarp(daysPerSecond: number): string {
  if (daysPerSecond === 0) {
    return 'paused'
  }

  if (daysPerSecond < 1) {
    return `${(daysPerSecond * 24).toFixed(1)} h / s`
  }

  return `${daysPerSecond.toFixed(daysPerSecond >= 10 ? 0 : 1)} d / s`
}

export function formatUtcDate(date: Date): string {
  return date.toUTCString().replace('GMT', 'UTC')
}

/**
 * Formats an ETA expressed in days into a human-readable string.
 * Returns an em-dash when the ship is stationary (etaDays is null).
 */
export function formatEtaDays(etaDays: number | null): string {
  if (etaDays === null) {
    return '—'
  }

  if (etaDays < 1) {
    return `${(etaDays * 24).toFixed(1)} h`
  }

  if (etaDays < 365.25) {
    return `${etaDays.toFixed(1)} d`
  }

  return `${(etaDays / 365.25).toFixed(1)} yr`
}
