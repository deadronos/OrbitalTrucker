import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { PITCH_LIMIT_RAD, type ShipState } from '../simulation/physics'
import { directionToYawPitch } from '../simulation/trajectory'
import { SUN } from '../solar-data'
import {
  createEphemerisSolarBodyResolver,
  resolveLocationPosition,
} from '../world/locations'

/**
 * When `autoOrientTrigger` increments, reads the current target position from
 * the destination catalog and rotates the ship to face it by mutating
 * `shipStateRef` (yaw and pitch).
 */
export function useAutoOrient(
  autoOrientTrigger: number,
  selectedLocationIdRef: React.RefObject<string>,
  shipStateRef: React.RefObject<ShipState>,
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

    const targetPos = resolveLocationPosition(selectedLocationIdRef.current, {
      date: simulatedDateRef.current,
      resolveSolarBodyPosition: (bodyName, date) => {
        if (bodyName === SUN.name) {
          return zeroVector
        }

        return (
          bodyPositionsRef.current.get(bodyName) ??
          fallbackSolarBodyResolver(bodyName, date)
        )
      },
    })

    const direction = new Vector3().subVectors(
      targetPos,
      shipStateRef.current.position,
    )

    if (direction.length() > 0) {
      direction.normalize()
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
    bodyPositionsRef,
    simulatedDateRef,
    fallbackSolarBodyResolver,
    zeroVector,
  ])
}
