import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  Color,
  Line,
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
import { TrajectoryLine } from '../scene/TrajectoryLine'
import { type SimulationMetrics } from '../simulation/types'
import { directionToYawPitch, planRoute } from '../simulation/trajectory'
import { SOLAR_BODIES, SUN } from '../solar-data'

export type SimulatorCanvasProps = {
  selectedBodyName: string
  timeWarpIndex: number
  timePaused: boolean
  /** Increment this value to trigger an immediate orient-to-target rotation. */
  autoOrientTrigger: number
  onMetricsChange: (metrics: SimulationMetrics) => void
}

function SceneContents({
  selectedBodyName,
  timePaused,
  timeWarpIndex,
  autoOrientTrigger,
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
  const trajectoryLineRef = useRef<Line>(null)
  const selectedBodyNameRef = useRef(selectedBodyName)
  const zeroVector = useMemo(() => new Vector3(0, 0, 0), [])

  useEffect(() => {
    selectedBodyNameRef.current = selectedBodyName
  }, [selectedBodyName])

  // Auto-orient: when autoOrientTrigger changes, rotate the ship to face the target.
  const prevAutoOrientTriggerRef = useRef(autoOrientTrigger)
  useEffect(() => {
    if (autoOrientTrigger === prevAutoOrientTriggerRef.current) return
    prevAutoOrientTriggerRef.current = autoOrientTrigger

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
      shipStateRef.current.pitch = Math.max(-1.35, Math.min(1.35, pitch))
    }
  }, [autoOrientTrigger, shipStateRef, zeroVector])

  // Per-frame: update body positions, target marker, trajectory line, and report metrics.
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

    // Trajectory planning
    const shipState = shipStateRef.current
    const plan = planRoute(
      shipState.position,
      selectedTargetPosition,
      forwardRef.current,
      shipState.velocity.length(),
    )

    // Update course line endpoints
    const line = trajectoryLineRef.current
    if (line) {
      const posAttr = line.geometry.attributes.position
      const arr = posAttr.array as Float32Array
      arr[0] = shipState.position.x
      arr[1] = shipState.position.y
      arr[2] = shipState.position.z
      arr[3] = selectedTargetPosition.x
      arr[4] = selectedTargetPosition.y
      arr[5] = selectedTargetPosition.z
      posAttr.needsUpdate = true
      line.geometry.computeBoundingSphere()
    }

    report(
      realDelta,
      date,
      shipState.position,
      shipState.velocity,
      selectedTargetPosition,
      plan.bearingAngleDeg,
      plan.etaDays,
    )
  })

  return (
    <>
      <SceneBackground />
      <SunMesh />
      <SolarBodies bodyMeshRefs={bodyMeshRefs} orbitEpoch={orbitEpoch} />
      <TargetMarker targetRef={targetMarkerRef} />
      <TrajectoryLine lineRef={trajectoryLineRef} />
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
      className="absolute inset-0 z-0"
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
