import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { buildNavigationVisualState } from '../../src/scene/navigation-visuals'
import type { TransferPlannerResult } from '../../src/simulation/transfer-planner'

describe('buildNavigationVisualState', () => {
  it('shows a separate intercept marker for future-intercept plans', () => {
    const state = buildNavigationVisualState(
      createPlan({
        currentPosition: new Vector3(10, 0, 0),
        predictedPosition: new Vector3(12, 1, 0),
        status: 'future-intercept',
      }),
    )

    expect(state.showInterceptMarker).toBe(true)
    expect(state.interceptPosition?.toArray()).toEqual([12, 1, 0])
  })

  it('hides the intercept marker when the planner is using the current fix', () => {
    const state = buildNavigationVisualState(
      createPlan({
        currentPosition: new Vector3(10, 0, 0),
        predictedPosition: new Vector3(10, 0, 0),
        status: 'current-position',
      }),
    )

    expect(state.showInterceptMarker).toBe(false)
    expect(state.interceptPosition).toBeNull()
  })
})

function createPlan({
  currentPosition,
  predictedPosition,
  status,
}: {
  currentPosition: Vector3
  predictedPosition: Vector3
  status: TransferPlannerResult['status']
}): TransferPlannerResult {
  return {
    destinationId: 'target',
    status,
    destination: {
      currentPosition,
      predictedPosition,
      predictedDate:
        status === 'future-intercept'
          ? new Date('2026-04-01T12:00:00.000Z')
          : null,
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition: predictedPosition.clone(),
      direction: new Vector3(1, 0, 0),
      bearingAngleDeg: 0,
    },
    travel: {
      currentDistanceAu: 1,
      plannedDistanceAu: 1,
      etaDays: 1,
      interceptTimeSeconds: 86_400,
      targetMotionDuringInterceptAu:
        currentPosition.distanceTo(predictedPosition),
      planningSpeedAuPerSec: 1e-5,
    },
    solver: {
      iterations: 2,
      solutionErrorSeconds: 0.1,
    },
  }
}
