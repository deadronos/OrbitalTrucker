import type { TransferPlannerResult } from '../simulation/transfer-planner'

const INTERCEPT_VISUAL_EPSILON_AU = 1e-6

export type NavigationVisualState = {
  destinationPosition: TransferPlannerResult['destination']['currentPosition']
  aimPosition: TransferPlannerResult['guidance']['aimPosition']
  interceptPosition:
    TransferPlannerResult['destination']['predictedPosition'] | null
  showInterceptMarker: boolean
}

/**
 * The cyan intercept ring and the drift tether should only render when
 * the planner has produced a real future-intercept solution. Chase
 * states (intercept-overrun, lead-chase) hide the marker so the
 * player can see the planner has fallen back to live lead-pursuit.
 */
export function shouldShowInterceptMarker(
  plannerResult: TransferPlannerResult,
): boolean {
  return plannerResult.status === 'future-intercept'
}

export function buildNavigationVisualState(
  plannerResult: TransferPlannerResult,
): NavigationVisualState {
  const destinationPosition = plannerResult.destination.currentPosition.clone()
  const aimPosition = plannerResult.guidance.aimPosition.clone()
  const predictedPosition = plannerResult.destination.predictedPosition.clone()
  const showInterceptMarker =
    shouldShowInterceptMarker(plannerResult) &&
    destinationPosition.distanceTo(predictedPosition) >
      INTERCEPT_VISUAL_EPSILON_AU

  return {
    destinationPosition,
    aimPosition,
    interceptPosition: showInterceptMarker ? predictedPosition : null,
    showInterceptMarker,
  }
}
