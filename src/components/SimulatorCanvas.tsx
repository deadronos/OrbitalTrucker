import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  Color,
  Mesh,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { useCameraFollow } from '../hooks/useCameraFollow'
import { useKeyboardInput } from '../hooks/useKeyboardInput'
import { usePointerInput } from '../hooks/usePointerInput'
import { useShipPhysics } from '../hooks/useShipPhysics'
import { useSimulationMetrics } from '../hooks/useSimulationMetrics'
import { useTimeSimulation } from '../hooks/useTimeSimulation'
import { getHeliocentricPositionAu } from '../orbital-mechanics'
import { SceneBackground } from '../scene/SceneBackground'
import { ShipMesh } from '../scene/ShipMesh'
import { SolarBodies, type BodyRefs } from '../scene/SolarBodies'
import { SunMesh } from '../scene/SunMesh'
import { TargetMarker } from '../scene/TargetMarker'
import { type SimulationMetrics } from '../simulation/types'
import { SOLAR_BODIES, SUN } from '../solar-data'

export type SimulatorCanvasProps = {
  selectedBodyName: string
  timeWarpIndex: number
  timePaused: boolean
  onMetricsChange: (metrics: SimulationMetrics) => void
}

function SceneContents({
  selectedBodyName,
  timePaused,
  timeWarpIndex,
  onMetricsChange,
}: SimulatorCanvasProps) {
  const { gl } = useThree()

  // Input hooks
  const keyStateRef = useKeyboardInput()
  const { shipStateRef, shipRef, forwardRef, upRef } =
    useShipPhysics(keyStateRef)
  usePointerInput(gl.domElement, shipStateRef)

  // Simulation hooks
  const { simulatedDateRef, orbitEpoch } = useTimeSimulation(
    timeWarpIndex,
    timePaused,
  )
  useCameraFollow(shipStateRef, forwardRef, upRef)
  const { report } = useSimulationMetrics(onMetricsChange)

  // Shared state for body positions (written each frame, read by marker + metrics)
  const bodyMeshRefs = useRef<Record<string, BodyRefs>>({})
  const bodyPositionsRef = useRef<Map<string, Vector3>>(new Map())
  const targetMarkerRef = useRef<Mesh>(null)
  const selectedBodyNameRef = useRef(selectedBodyName)
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])

  useEffect(() => {
    selectedBodyNameRef.current = selectedBodyName
  }, [selectedBodyName])

  // Per-frame: update body positions, target marker, and report metrics.
  // This useFrame fires after the hook frames (time, ship, camera) because
  // hooks are registered before child components in mount order.
  useFrame((state, delta) => {
    const realDelta = Math.min(delta, 0.05)
    const date = simulatedDateRef.current

    for (const body of SOLAR_BODIES) {
      const position = getHeliocentricPositionAu(body, date)
      const refs = bodyMeshRefs.current[body.name]

      refs?.mesh?.position.copy(position)

      if (refs?.mesh) {
        refs.mesh.rotation.y += 0.0025
      }

      if (refs?.ring) {
        refs.ring.rotation.x = Math.PI / 2.35
      }

      bodyPositionsRef.current.set(body.name, position)
    }

    const selectedName = selectedBodyNameRef.current
    const selectedTargetPosition =
      selectedName === SUN.name
        ? zeroVector
        : (bodyPositionsRef.current.get(selectedName) ?? zeroVector)
    const targetVisual = SOLAR_BODIES.find((body) => body.name === selectedName)

    targetMarkerRef.current?.position.copy(selectedTargetPosition)
    targetMarkerRef.current?.lookAt(state.camera.position)
    targetMarkerRef.current?.scale.setScalar(
      targetVisual
        ? targetVisual.displayRadiusAu * 7
        : SUN.displayRadiusAu * 1.7,
    )

    const shipState = shipStateRef.current

    report(
      realDelta,
      date,
      shipState.position,
      shipState.velocity,
      selectedTargetPosition,
    )
  })

  return (
    <>
      <SceneBackground />
      <SunMesh />
      <SolarBodies bodyMeshRefs={bodyMeshRefs} orbitEpoch={orbitEpoch} />
      <TargetMarker targetRef={targetMarkerRef} />
      <ShipMesh ref={shipRef} />
    </>
  )
}

export function SimulatorCanvas(props: SimulatorCanvasProps) {
  return (
    <Canvas
      camera={{
        fov: 58,
        near: 0.00001,
        far: 8000,
        position: [0.85, 0.1, 0.25],
      }}
      className="sim-canvas"
      dpr={[1, 2]}
      frameloop="always"
      gl={{ antialias: true, logarithmicDepthBuffer: true }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace
        gl.toneMapping = ACESFilmicToneMapping
        gl.setClearColor(new Color('#020409'))
      }}
    >
      <SceneContents {...props} />
    </Canvas>
  )
}
