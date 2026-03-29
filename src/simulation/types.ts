export type SimulationMetrics = {
  simulatedDate: Date
  shipSpeedKmPerSecond: number
  heliocentricDistanceAu: number
  targetDistanceAu: number
}

export const TIME_WARP_STEPS = [0, 1 / 48, 1 / 12, 0.25, 1, 7, 30, 90] as const

export const INITIAL_METRICS: SimulationMetrics = {
  simulatedDate: new Date('2026-03-29T00:00:00.000Z'),
  shipSpeedKmPerSecond: 0,
  heliocentricDistanceAu: 1.04,
  targetDistanceAu: 0,
}
