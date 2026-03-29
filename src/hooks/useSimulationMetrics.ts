import { useCallback, useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { ASTRONOMICAL_UNIT_KM } from '../solar-data'
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
    targetPosition: Vector3,
    targetBearingDeg: number,
    etaDays: number | null,
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
      targetPosition: Vector3,
      targetBearingDeg: number,
      etaDays: number | null,
    ) => {
      accumulatorRef.current += deltaSec

      if (accumulatorRef.current >= 0.1) {
        accumulatorRef.current = 0
        onMetricsChangeRef.current({
          simulatedDate: new Date(simulatedDate),
          shipSpeedKmPerSecond: velocity.length() * ASTRONOMICAL_UNIT_KM,
          heliocentricDistanceAu: shipPosition.length(),
          targetDistanceAu: shipPosition.distanceTo(targetPosition),
          targetBearingDeg,
          etaDays,
        })
      }
    },
    [],
  )

  return { report }
}
