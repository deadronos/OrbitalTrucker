import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { ACESFilmicToneMapping, Color, Line, Mesh, SRGBColorSpace } from 'three'

import { useAutonomousGuidance } from '../hooks/useAutonomousGuidance'
import { useBodyPositions } from '../hooks/useBodyPositions'
import { useCameraFollow } from '../hooks/useCameraFollow'
import { useShipPhysics } from '../hooks/useShipPhysics'
import { useSimulationMetrics } from '../hooks/useSimulationMetrics'
import { useTimeSimulation } from '../hooks/useTimeSimulation'
import { SceneBackground } from '../scene/SceneBackground'
import { buildNavigationVisualState } from '../scene/navigation-visuals'
import { ShipMesh } from '../scene/ShipMesh'
import { SolarBodies } from '../scene/SolarBodies'
import { SunMesh } from '../scene/SunMesh'
import { TargetMarker } from '../scene/TargetMarker'
import { TrajectoryLine } from '../scene/TrajectoryLine'
import { createIdleShipControls } from '../simulation/physics'
import { type SimulationMetrics } from '../simulation/types'
import { SUN } from '../solar-data'
import { getLocationById, getLocationMarkerScaleAu } from '../world/locations'

export type SimulatorCanvasProps = {
  selectedLocationId: string
  timeWarpIndex: number
  timePaused: boolean
  onMetricsChange: (metrics: SimulationMetrics) => void
}

function SceneContents({
  selectedLocationId,
  timePaused,
  timeWarpIndex,
  onMetricsChange,
}: SimulatorCanvasProps) {
  const controlInputRef = useRef(createIdleShipControls())
  const { shipStateRef, shipRef, forwardRef, upRef } =
    useShipPhysics(controlInputRef)

  // Simulation hooks (registered in frame-execution order)
  const { simulatedDateRef, orbitEpoch } = useTimeSimulation(
    timeWarpIndex,
    timePaused,
  )
  useCameraFollow(shipStateRef, forwardRef, upRef)
  const { report } = useSimulationMetrics(onMetricsChange)

  // Refs shared across hooks and the orchestrator frame
  const destinationMarkerRef = useRef<Mesh>(null)
  const interceptMarkerRef = useRef<Mesh>(null)
  const trajectoryLineRef = useRef<Line>(null)
  const interceptLineRef = useRef<Line>(null)
  const selectedLocationIdRef = useRef(selectedLocationId)

  useEffect(() => {
    selectedLocationIdRef.current = selectedLocationId
  }, [selectedLocationId])

  // Body positions hook — owns mesh refs, updates transforms, and exposes the
  // latest positions map. Registered after useTimeSimulation so it reads the
  // already-advanced simulated date each frame.
  const { bodyMeshRefs, bodyPositionsRef } = useBodyPositions(simulatedDateRef)

  const { guidanceResultRef, plannerResultRef } = useAutonomousGuidance({
    controlInputRef,
    selectedLocationIdRef,
    shipStateRef,
    bodyPositionsRef,
    simulatedDateRef,
  })

  // Per-frame: drive target marker, trajectory line, and metrics.
  // Fires after the simulation hooks (time → guidance → ship → camera → body)
  // because those hooks use lower frame priorities.
  useFrame((state, delta) => {
    const realDelta = Math.min(delta, 0.05)
    const plan = plannerResultRef.current
    const visuals = buildNavigationVisualState(plan)
    const selectedLocation = getLocationById(plan.destinationId)
    const markerScale =
      (selectedLocation
        ? getLocationMarkerScaleAu(selectedLocation.id)
        : SUN.displayRadiusAu) * 7

    destinationMarkerRef.current?.position.copy(visuals.destinationPosition)
    destinationMarkerRef.current?.lookAt(state.camera.position)
    destinationMarkerRef.current?.scale.setScalar(markerScale)

    if (interceptMarkerRef.current) {
      interceptMarkerRef.current.visible = visuals.showInterceptMarker

      if (visuals.interceptPosition) {
        interceptMarkerRef.current.position.copy(visuals.interceptPosition)
        interceptMarkerRef.current.lookAt(state.camera.position)
        interceptMarkerRef.current.scale.setScalar(markerScale * 0.72)
      }
    }

    const shipState = shipStateRef.current

    // Update course line endpoints
    const line = trajectoryLineRef.current
    if (line) {
      updateLineEndpoints(line, shipState.position, visuals.aimPosition)
    }

    const interceptLine = interceptLineRef.current
    if (interceptLine) {
      interceptLine.visible = visuals.showInterceptMarker

      if (visuals.interceptPosition) {
        updateLineEndpoints(
          interceptLine,
          visuals.destinationPosition,
          visuals.interceptPosition,
        )
      }
    }

    report(
      realDelta,
      simulatedDateRef.current,
      shipState.position,
      shipState.velocity,
      plan,
      guidanceResultRef.current,
    )
  })

  return (
    <>
      <SceneBackground />
      <SunMesh />
      <SolarBodies bodyMeshRefs={bodyMeshRefs} orbitEpoch={orbitEpoch} />
      <TargetMarker targetRef={destinationMarkerRef} />
      <TargetMarker
        color="#f7c77a"
        innerRadius={0.08}
        opacity={0.94}
        outerRadius={0.12}
        targetRef={interceptMarkerRef}
      />
      <TrajectoryLine lineRef={trajectoryLineRef} />
      <TrajectoryLine
        color="#f7c77a"
        lineRef={interceptLineRef}
        opacity={0.38}
      />
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

// Default export enables React.lazy(() => import('./SimulatorCanvas')) in App.tsx.
export default SimulatorCanvas

function updateLineEndpoints(
  line: Line,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
) {
  const posAttr = line.geometry.attributes.position
  const arr = posAttr.array as Float32Array

  arr[0] = start.x
  arr[1] = start.y
  arr[2] = start.z
  arr[3] = end.x
  arr[4] = end.y
  arr[5] = end.z
  posAttr.needsUpdate = true
  line.geometry.computeBoundingSphere()
}
