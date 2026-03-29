import { useEffect } from 'react'
import { MathUtils, Vector2 } from 'three'

import type { ShipState } from '../simulation/physics'

/**
 * Attaches pointer (mouse/touch) and wheel event listeners to the canvas
 * DOM element. Directly mutates `shipStateRef` for yaw, pitch, and
 * chaseDistance so the ship responds to mouse drag and scroll without
 * triggering React re-renders.
 */
export function usePointerInput(
  domElement: HTMLElement | null,
  shipStateRef: React.RefObject<ShipState>,
): void {
  useEffect(() => {
    if (!domElement) return

    const pointerState = { active: false, last: new Vector2() }

    const handlePointerDown = (event: PointerEvent) => {
      pointerState.active = true
      pointerState.last.set(event.clientX, event.clientY)
      domElement.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerState.active) return

      const deltaX = event.clientX - pointerState.last.x
      const deltaY = event.clientY - pointerState.last.y
      const state = shipStateRef.current

      state.yaw -= deltaX * 0.005
      state.pitch = MathUtils.clamp(state.pitch - deltaY * 0.0035, -1.35, 1.35)
      pointerState.last.set(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      pointerState.active = false
      domElement.releasePointerCapture(event.pointerId)
    }

    const handlePointerLeave = () => {
      pointerState.active = false
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      shipStateRef.current.chaseDistance = MathUtils.clamp(
        shipStateRef.current.chaseDistance + event.deltaY * 0.00025,
        0.04,
        1.2,
      )
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerLeave)
    domElement.addEventListener('wheel', handleWheel, { passive: false })
    domElement.addEventListener('contextmenu', handleContextMenu)

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerLeave)
      domElement.removeEventListener('wheel', handleWheel)
      domElement.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [domElement, shipStateRef])
}
