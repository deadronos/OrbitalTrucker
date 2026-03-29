import { DoubleSide, Mesh } from 'three'

type TargetMarkerProps = {
  targetRef: React.RefObject<Mesh | null>
}

/**
 * Visual ring displayed around the currently selected navigation target.
 * Position, orientation, and scale are driven imperatively each frame by
 * the scene orchestrator via `targetRef`.
 */
export function TargetMarker({ targetRef }: TargetMarkerProps) {
  return (
    <mesh ref={targetRef}>
      <ringGeometry args={[0.12, 0.16, 64]} />
      <meshBasicMaterial
        color="#9fe0ff"
        opacity={0.86}
        side={DoubleSide}
        transparent
      />
    </mesh>
  )
}
