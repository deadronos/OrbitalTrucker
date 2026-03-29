import type { TransferPlannerResult } from '../simulation/transfer-planner'

const INTERCEPT_VISUAL_EPSILON_AU = 1e-6

export type NavigationVisualState = {
  destinationPosition: TransferPlannerResult['destination']['currentPosition']
  aimPosition: TransferPlannerResult['guidance']['aimPosition']
  interceptPosition:
    | TransferPlannerResult['destination']['predictedPosition']
    | null
  showInterceptMarker: boolean
}

export function buildNavigationVisualState(
  plannerResult: TransferPlannerResult,
): NavigationVisualState {
  const destinationPosition = plannerResult.destination.currentPosition.clone()
  const aimPosition = plannerResult.guidance.aimPosition.clone()
  const predictedPosition = plannerResult.destination.predictedPosition.clone()
  const showInterceptMarker =
    plannerResult.status === 'future-intercept' &&
    destinationPosition.distanceTo(predictedPosition) >
      INTERCEPT_VISUAL_EPSILON_AU

  return {
    destinationPosition,
    aimPosition,
    interceptPosition: showInterceptMarker ? predictedPosition : null,
    showInterceptMarker,
  }
}
