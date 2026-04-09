import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import {
  computeAutonomousGuidance,
  type AutonomousGuidanceResult,
} from '../simulation/autonomous-guidance'
import {
  createInitialShipState,
  getShipOrientationFromAngles,
  type ShipControlInput,
  type ShipState,
} from '../simulation/physics'
import {
  planTransfer,
  type TransferPlannerResult,
} from '../simulation/transfer-planner'
import { SUN } from '../solar-data'
import {
  createEphemerisSolarBodyResolver,
  resolveLocationPosition,
} from '../world/locations'

type UseAutonomousGuidanceArgs = {
  controlInputRef: React.RefObject<ShipControlInput>
  selectedLocationIdRef: React.RefObject<string>
  shipStateRef: React.RefObject<ShipState>
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>
  simulatedDateRef: React.RefObject<Date>
}

type AutonomousGuidanceRefs = {
  plannerResultRef: React.RefObject<TransferPlannerResult>
  guidanceResultRef: React.RefObject<AutonomousGuidanceResult>
}

export function useAutonomousGuidance({
  controlInputRef,
  selectedLocationIdRef,
  shipStateRef,
  bodyPositionsRef,
  simulatedDateRef,
}: UseAutonomousGuidanceArgs): AutonomousGuidanceRefs {
  const fallbackSolarBodyResolver = useMemo(
    () => createEphemerisSolarBodyResolver(),
    [],
  )
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])
  const placeholderPlannerResult = useMemo(
    () => createPlaceholderPlannerResult(),
    [],
  )
  const plannerResultRef = useRef<TransferPlannerResult>(
    placeholderPlannerResult,
  )
  const guidanceResultRef = useRef<AutonomousGuidanceResult>(
    computeAutonomousGuidance(
      createInitialShipState(),
      placeholderPlannerResult,
    ),
  )

  useFrame(() => {
    const plannerResult = buildPlannerResult(
      selectedLocationIdRef.current,
      shipStateRef.current,
      simulatedDateRef.current,
      bodyPositionsRef.current,
      fallbackSolarBodyResolver,
      zeroVector,
    )
    const guidanceResult = computeAutonomousGuidance(
      shipStateRef.current,
      plannerResult,
      guidanceResultRef.current.phase,
    )

    plannerResultRef.current = plannerResult
    guidanceResultRef.current = guidanceResult
    controlInputRef.current = guidanceResult.controls
  }, -2)

  return {
    plannerResultRef,
    guidanceResultRef,
  }
}

function createPlaceholderPlannerResult(): TransferPlannerResult {
  return {
    destinationId: '',
    status: 'current-position',
    destination: {
      currentPosition: new Vector3(0, 0, 0),
      predictedPosition: new Vector3(0, 0, 0),
      predictedDate: null,
      estimatedVelocityAuPerSec: new Vector3(0, 0, 0),
    },
    guidance: {
      aimPosition: new Vector3(0, 0, 0),
      direction: new Vector3(1, 0, 0),
      bearingAngleDeg: 0,
    },
    travel: {
      currentDistanceAu: 0,
      plannedDistanceAu: 0,
      etaDays: null,
      interceptTimeSeconds: null,
      targetMotionDuringInterceptAu: 0,
      planningSpeedAuPerSec: 0,
    },
    solver: {
      iterations: 0,
      solutionErrorSeconds: null,
    },
  }
}

function buildPlannerResult(
  destinationId: string,
  shipState: ShipState,
  simulatedDate: Date,
  bodyPositions: Map<string, Vector3>,
  fallbackSolarBodyResolver: ReturnType<typeof createEphemerisSolarBodyResolver>,
  zeroVector: Vector3,
): TransferPlannerResult {
  const { forward } = getShipOrientationFromAngles(
    shipState.yaw,
    shipState.pitch,
  )

  return planTransfer({
    date: simulatedDate,
    shipPosition: shipState.position,
    shipVelocity: shipState.velocity,
    shipForward: forward,
    destinationId,
    resolveDestinationPosition: (resolveDestinationId, resolveDate) =>
      resolveLocationPosition(resolveDestinationId, {
        date: resolveDate,
        resolveSolarBodyPosition: (bodyName, bodyDate) => {
          if (bodyName === SUN.name) {
            return zeroVector
          }

          return (
            bodyPositions.get(bodyName) ??
            fallbackSolarBodyResolver(bodyName, bodyDate)
          )
        },
      }),
  })
}
