import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { PITCH_LIMIT_RAD, type ShipState } from '../simulation/physics'
import { directionToYawPitch } from '../simulation/trajectory'
import { SUN } from '../solar-data'

/**
 * When `autoOrientTrigger` increments, reads the current target position from
 * `bodyPositionsRef` and rotates the ship to face it by mutating `shipStateRef`
 * (yaw and pitch). The Sun is treated as the origin (0, 0, 0).
 */
export function useAutoOrient(
  autoOrientTrigger: number,
  selectedBodyNameRef: React.RefObject<string>,
  shipStateRef: React.RefObject<ShipState>,
  bodyPositionsRef: React.RefObject<Map<string, Vector3>>,
): void {
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])
  const prevTriggerRef = useRef(autoOrientTrigger)

  useEffect(() => {
    if (autoOrientTrigger === prevTriggerRef.current) return
    prevTriggerRef.current = autoOrientTrigger

    const targetPos =
      selectedBodyNameRef.current === SUN.name
        ? zeroVector
        : (bodyPositionsRef.current.get(selectedBodyNameRef.current) ??
          zeroVector)

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
    selectedBodyNameRef,
    shipStateRef,
    bodyPositionsRef,
    zeroVector,
  ])
}
