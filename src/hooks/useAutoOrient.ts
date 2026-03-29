import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { PITCH_LIMIT_RAD, type ShipState } from '../simulation/physics'
import { directionToYawPitch } from '../simulation/trajectory'
import { planTransfer } from '../simulation/transfer-planner'
import { SUN } from '../solar-data'
import {
  createEphemerisSolarBodyResolver,
  resolveLocationPosition,
} from '../world/locations'

/**
 * When `autoOrientTrigger` increments, computes a fresh transfer plan for the
 * selected destination and rotates the ship to face the planner's aim point by
 * mutating `shipStateRef` (yaw and pitch).
 */
export function useAutoOrient(
  autoOrientTrigger: number,
  selectedLocationIdRef: React.RefObject<string>,
  shipStateRef: React.RefObject<ShipState>,
  shipForwardRef: React.RefObject<Vector3>,
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>,
  simulatedDateRef: React.RefObject<Date>,
): void {
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])
  const prevTriggerRef = useRef(autoOrientTrigger)
  const fallbackSolarBodyResolver = useMemo(
    () => createEphemerisSolarBodyResolver(),
    [],
  )

  useEffect(() => {
    if (autoOrientTrigger === prevTriggerRef.current) return
    prevTriggerRef.current = autoOrientTrigger

    const plan = planTransfer({
      date: simulatedDateRef.current,
      shipPosition: shipStateRef.current.position,
      shipVelocity: shipStateRef.current.velocity,
      shipForward: shipForwardRef.current,
      destinationId: selectedLocationIdRef.current,
      resolveDestinationPosition: (destinationId, resolveDate) =>
        resolveLocationPosition(destinationId, {
          date: resolveDate,
          resolveSolarBodyPosition: (bodyName, bodyDate) => {
            if (bodyName === SUN.name) {
              return zeroVector
            }

            return (
              bodyPositionsRef.current.get(bodyName) ??
              fallbackSolarBodyResolver(bodyName, bodyDate)
            )
          },
        }),
    })

    const direction = plan.guidance.direction.clone()

    if (direction.length() > 0) {
      const { yaw, pitch } = directionToYawPitch(direction)
      shipStateRef.current.yaw = yaw
      shipStateRef.current.pitch = Math.max(
        -PITCH_LIMIT_RAD,
        Math.min(PITCH_LIMIT_RAD, pitch),
      )
    }
  }, [
    autoOrientTrigger,
    selectedLocationIdRef,
    shipStateRef,
    shipForwardRef,
    bodyPositionsRef,
    simulatedDateRef,
    fallbackSolarBodyResolver,
    zeroVector,
  ])
}
