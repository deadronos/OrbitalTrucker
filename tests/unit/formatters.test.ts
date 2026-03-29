import {
  formatAutonomousPhase,
  formatDistanceAu,
  formatDurationSeconds,
  formatShipSpeedKmPerSecond,
  formatShortUtcDate,
  formatTimeWarp,
  formatUtcDate,
} from '../../src/simulation/formatters'
import { describe, expect, it } from 'vitest'

describe('formatters', () => {
  it('formats AU distances above one AU directly', () => {
    expect(formatDistanceAu(5.203)).toBe('5.20 AU')
  })

  it('formats sub-AU distances as million kilometers', () => {
    expect(formatDistanceAu(0.5)).toBe('74.80 million km')
  })

  it('formats ship speed with context-aware precision', () => {
    expect(formatShipSpeedKmPerSecond(42.42)).toBe('42.4 km/s')
    expect(formatShipSpeedKmPerSecond(1200.4)).toBe('1200 km/s')
  })

  it('formats time warp labels for paused, hourly, and daily modes', () => {
    expect(formatTimeWarp(0)).toBe('paused')
    expect(formatTimeWarp(0.25)).toBe('6.0 h / s')
    expect(formatTimeWarp(7)).toBe('7.0 d / s')
    expect(formatTimeWarp(30)).toBe('30 d / s')
  })

  it('formats UTC dates consistently', () => {
    expect(formatUtcDate(new Date('2026-03-29T12:00:00.000Z'))).toBe(
      'Sun, 29 Mar 2026 12:00:00 UTC',
    )
  })

  it('formats compact UTC dates for intercept-fix telemetry', () => {
    expect(formatShortUtcDate(new Date('2026-03-29T12:00:00.000Z'))).toBe(
      'Sun, 29 Mar 2026 12:00 UTC',
    )
  })

  it('formats travel durations across short and long horizons', () => {
    expect(formatDurationSeconds(45)).toBe('45 s')
    expect(formatDurationSeconds(7_200)).toBe('2.0 h')
    expect(formatDurationSeconds(14 * 86_400)).toBe('14.0 d')
  })

  it('formats autonomous guidance phases for the HUD', () => {
    expect(formatAutonomousPhase('acquiring')).toBe('Acquiring course')
    expect(formatAutonomousPhase('cruising')).toBe('Cruising')
    expect(formatAutonomousPhase('braking')).toBe('Braking')
    expect(formatAutonomousPhase('arrived')).toBe('Arrived')
  })
})
