import { useCallback, useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { ASTRONOMICAL_UNIT_KM } from '../solar-data'
import type { AutonomousGuidanceResult } from '../simulation/autonomous-guidance'
import type { TransferPlannerResult } from '../simulation/transfer-planner'
import type { SimulationMetrics } from '../simulation/types'

/**
 * Returns a `report` function that throttles `SimulationMetrics` callbacks
 * to approximately 10 Hz. Call it every frame with current simulation state.
 */
export function useSimulationMetrics(
  onMetricsChange: (metrics: SimulationMetrics) => void,
): {
  report: (
    deltaSec: number,
    simulatedDate: Date,
    shipPosition: Vector3,
    velocity: Vector3,
    plannerResult: TransferPlannerResult,
    guidanceResult: AutonomousGuidanceResult,
  ) => void
} {
  const accumulatorRef = useRef(0)
  const onMetricsChangeRef = useRef(onMetricsChange)

  useEffect(() => {
    onMetricsChangeRef.current = onMetricsChange
  }, [onMetricsChange])

  const report = useCallback(
    (
      deltaSec: number,
      simulatedDate: Date,
      shipPosition: Vector3,
      velocity: Vector3,
      plannerResult: TransferPlannerResult,
      guidanceResult: AutonomousGuidanceResult,
    ) => {
      accumulatorRef.current += deltaSec

      if (accumulatorRef.current >= 0.1) {
        accumulatorRef.current = 0
        onMetricsChangeRef.current({
          simulatedDate: new Date(simulatedDate),
          shipSpeedKmPerSecond: velocity.length() * ASTRONOMICAL_UNIT_KM,
          heliocentricDistanceAu: shipPosition.length(),
          currentTargetDistanceAu: plannerResult.travel.currentDistanceAu,
          plannedDistanceAu: plannerResult.travel.plannedDistanceAu,
          plannerStatus: plannerResult.status,
          autonomousPhase: guidanceResult.phase,
          targetBearingDeg: plannerResult.guidance.bearingAngleDeg,
          etaDays: plannerResult.travel.etaDays,
          interceptTimeSeconds: plannerResult.travel.interceptTimeSeconds,
          targetMotionDuringInterceptAu:
            plannerResult.travel.targetMotionDuringInterceptAu,
        })
      }
    },
    [],
  )

  return { report }
}
