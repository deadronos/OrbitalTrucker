import type { Line } from 'three'

type TrajectoryLineProps = {
  lineRef: React.RefObject<Line | null>
}

/**
 * Visual straight-line course indicator drawn from the ship to the currently
 * selected target. The two endpoint positions are driven imperatively each
 * frame by the scene orchestrator via the forwarded `lineRef`.
 */
export function TrajectoryLine({ lineRef }: TrajectoryLineProps) {
  return (
    <line ref={lineRef as unknown as React.Ref<SVGLineElement>}>
      <bufferGeometry>
        <bufferAttribute
          args={[new Float32Array(6), 3]}
          attach="attributes-position"
        />
      </bufferGeometry>
      <lineBasicMaterial color="#9fe0ff" opacity={0.45} transparent />
    </line>
  )
}
