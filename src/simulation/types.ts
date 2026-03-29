import type { AutonomousGuidancePhase } from './autonomous-guidance'
import type { TransferPlannerStatus } from './transfer-planner'

export type SimulationMetrics = {
  simulatedDate: Date
  shipSpeedKmPerSecond: number
  heliocentricDistanceAu: number
  /** Straight-line distance to the destination's current resolved position. */
  currentTargetDistanceAu: number
  /** Distance to the planner's current aim point. */
  plannedDistanceAu: number
  plannerStatus: TransferPlannerStatus
  autonomousPhase: AutonomousGuidancePhase
  /** Angle in degrees between the ship's forward heading and the planner aim point. */
  targetBearingDeg: number
  /** Estimated travel time in days to the planner's current aim point. */
  etaDays: number | null
  /** Planned time-to-intercept for the current route solution. */
  interceptTimeSeconds: number | null
  /** UTC timestamp for the predicted intercept fix when one exists. */
  interceptDate: Date | null
  /** Expected destination motion between the current fix and intercept aim point. */
  targetMotionDuringInterceptAu: number
}

export const TIME_WARP_STEPS = [0, 1 / 48, 1 / 12, 0.25, 1, 7, 30, 90] as const

export const INITIAL_SIMULATED_DATE = new Date('2026-03-29T00:00:00.000Z')

export const INITIAL_METRICS: SimulationMetrics = {
  simulatedDate: new Date(INITIAL_SIMULATED_DATE),
  shipSpeedKmPerSecond: 0,
  heliocentricDistanceAu: 1.04,
  currentTargetDistanceAu: 0,
  plannedDistanceAu: 0,
  plannerStatus: 'current-position',
  autonomousPhase: 'arrived',
  targetBearingDeg: 0,
  etaDays: null,
  interceptTimeSeconds: null,
  interceptDate: null,
  targetMotionDuringInterceptAu: 0,
}
