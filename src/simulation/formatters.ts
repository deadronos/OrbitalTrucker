import { ASTRONOMICAL_UNIT_KM } from '../solar-data'
import type { AutonomousGuidancePhase } from './autonomous-guidance'
import type { TransferPlannerStatus } from './transfer-planner'

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

export function formatShortUtcDate(date: Date): string {
  return date.toUTCString().replace(/:\d{2} GMT$/, ' UTC')
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

export function formatDurationSeconds(durationSeconds: number | null): string {
  if (durationSeconds === null) {
    return '—'
  }

  if (durationSeconds < 60) {
    return `${durationSeconds.toFixed(0)} s`
  }

  if (durationSeconds < 3_600) {
    return `${(durationSeconds / 60).toFixed(0)} min`
  }

  const durationDays = durationSeconds / 86_400

  if (durationDays < 1) {
    return `${(durationSeconds / 3_600).toFixed(1)} h`
  }

  if (durationDays < 365.25) {
    return `${durationDays.toFixed(1)} d`
  }

  return `${(durationDays / 365.25).toFixed(1)} yr`
}

export function formatAutonomousPhase(phase: AutonomousGuidancePhase): string {
  switch (phase) {
    case 'acquiring':
      return 'Acquiring course'
    case 'cruising':
      return 'Cruising'
    case 'braking':
      return 'Braking'
    case 'arrived':
      return 'Arrived'
  }
}

export function formatTransferPlannerStatus(
  status: TransferPlannerStatus,
): string {
  switch (status) {
    case 'current-position':
      return 'Current fix'
    case 'future-intercept':
      return 'Future intercept'
    case 'no-solution':
      return 'Fallback'
  }
}
