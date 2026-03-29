import { DoubleSide, Mesh } from 'three'

type TargetMarkerProps = {
  targetRef: React.RefObject<Mesh | null>
  color?: string
  innerRadius?: number
  outerRadius?: number
  opacity?: number
}

/**
 * Visual ring displayed around the currently selected navigation target.
 * Position, orientation, and scale are driven imperatively each frame by
 * the scene orchestrator via `targetRef`.
 */
export function TargetMarker({
  targetRef,
  color = '#9fe0ff',
  innerRadius = 0.12,
  outerRadius = 0.16,
  opacity = 0.86,
}: TargetMarkerProps) {
  return (
    <mesh ref={targetRef}>
      <ringGeometry args={[innerRadius, outerRadius, 64]} />
      <meshBasicMaterial
        color={color}
        opacity={opacity}
        side={DoubleSide}
        transparent
      />
    </mesh>
  )
}
