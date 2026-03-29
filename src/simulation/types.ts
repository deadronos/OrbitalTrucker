export type SimulationMetrics = {
  simulatedDate: Date
  shipSpeedKmPerSecond: number
  heliocentricDistanceAu: number
  targetDistanceAu: number
  /** Angle in degrees between the ship's forward heading and the target (0–180). */
  targetBearingDeg: number
  /** Estimated straight-line travel time in days at current speed. Null when stationary. */
  etaDays: number | null
}

export const TIME_WARP_STEPS = [0, 1 / 48, 1 / 12, 0.25, 1, 7, 30, 90] as const

export const INITIAL_SIMULATED_DATE = new Date('2026-03-29T00:00:00.000Z')

export const INITIAL_METRICS: SimulationMetrics = {
  simulatedDate: new Date(INITIAL_SIMULATED_DATE),
  shipSpeedKmPerSecond: 0,
  heliocentricDistanceAu: 1.04,
  targetDistanceAu: 0,
  targetBearingDeg: 0,
  etaDays: null,
}
