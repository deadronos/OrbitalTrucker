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

import { useAutoOrient } from '../hooks/useAutoOrient'
import { useBodyPositions } from '../hooks/useBodyPositions'
import { useCameraFollow } from '../hooks/useCameraFollow'
import { useKeyboardInput } from '../hooks/useKeyboardInput'
import { usePointerInput } from '../hooks/usePointerInput'
import { useShipPhysics } from '../hooks/useShipPhysics'
import { useSimulationMetrics } from '../hooks/useSimulationMetrics'
import { useTimeSimulation } from '../hooks/useTimeSimulation'
import { SceneBackground } from '../scene/SceneBackground'
import { ShipMesh } from '../scene/ShipMesh'
import { SolarBodies } from '../scene/SolarBodies'
import { SunMesh } from '../scene/SunMesh'
import { TargetMarker } from '../scene/TargetMarker'
import { TrajectoryLine } from '../scene/TrajectoryLine'
import { planTransfer } from '../simulation/transfer-planner'
import { type SimulationMetrics } from '../simulation/types'
import { SUN } from '../solar-data'
import {
  createEphemerisSolarBodyResolver,
  getLocationById,
  getLocationMarkerScaleAu,
  resolveLocationPosition,
} from '../world/locations'

export type SimulatorCanvasProps = {
  selectedLocationId: string
  timeWarpIndex: number
  timePaused: boolean
  /** Increment this value to trigger an immediate orient-to-target rotation. */
  autoOrientTrigger: number
  onMetricsChange: (metrics: SimulationMetrics) => void
}

function SceneContents({
  selectedLocationId,
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

  // Simulation hooks (registered in frame-execution order)
  const { simulatedDateRef, orbitEpoch } = useTimeSimulation(
    timeWarpIndex,
    timePaused,
  )
  useCameraFollow(shipStateRef, forwardRef, upRef)
  const { report } = useSimulationMetrics(onMetricsChange)

  // Refs shared across hooks and the orchestrator frame
  const targetMarkerRef = useRef<Mesh>(null)
  const trajectoryLineRef = useRef<Line>(null)
  const selectedLocationIdRef = useRef(selectedLocationId)
  const fallbackSolarBodyResolver = useMemo(
    () => createEphemerisSolarBodyResolver(),
    [],
  )

  useEffect(() => {
    selectedLocationIdRef.current = selectedLocationId
  }, [selectedLocationId])

  // Body positions hook — owns mesh refs, updates transforms, and exposes the
  // latest positions map. Registered after useTimeSimulation so it reads the
  // already-advanced simulated date each frame.
  const { bodyMeshRefs, bodyPositionsRef } = useBodyPositions(simulatedDateRef)

  // Auto-orient hook — rotates the ship to face the target on demand.
  useAutoOrient(
    autoOrientTrigger,
    selectedLocationIdRef,
    shipStateRef,
    forwardRef,
    bodyPositionsRef,
    simulatedDateRef,
  )

  // Per-frame: drive target marker, trajectory line, and metrics.
  // Fires after the hook frames (time → ship → camera → body positions)
  // because hooks are registered before this subscription in mount order.
  useFrame((state, delta) => {
    const realDelta = Math.min(delta, 0.05)
    const date = simulatedDateRef.current

    const selectedLocationId = selectedLocationIdRef.current
    const selectedLocation = getLocationById(selectedLocationId)
    const resolveSelectedLocationPosition = (
      locationId: string,
      resolveDate: Date,
    ) =>
      resolveLocationPosition(locationId, {
        date: resolveDate,
        resolveSolarBodyPosition: (bodyName, bodyDate) =>
          resolveSolarBodyPosition(
            bodyName,
            bodyDate,
            bodyPositionsRef.current,
            fallbackSolarBodyResolver,
          ),
      })
    const plan = planTransfer({
      date,
      shipPosition: shipStateRef.current.position,
      shipVelocity: shipStateRef.current.velocity,
      shipForward: forwardRef.current,
      destinationId: selectedLocationId,
      resolveDestinationPosition: resolveSelectedLocationPosition,
    })

    targetMarkerRef.current?.position.copy(plan.destination.currentPosition)
    targetMarkerRef.current?.lookAt(state.camera.position)
    targetMarkerRef.current?.scale.setScalar(
      (selectedLocation
        ? getLocationMarkerScaleAu(selectedLocation.id)
        : SUN.displayRadiusAu) * 7,
    )

    const shipState = shipStateRef.current

    // Update course line endpoints
    const line = trajectoryLineRef.current
    if (line) {
      const posAttr = line.geometry.attributes.position
      const arr = posAttr.array as Float32Array
      arr[0] = shipState.position.x
      arr[1] = shipState.position.y
      arr[2] = shipState.position.z
      arr[3] = plan.guidance.aimPosition.x
      arr[4] = plan.guidance.aimPosition.y
      arr[5] = plan.guidance.aimPosition.z
      posAttr.needsUpdate = true
      line.geometry.computeBoundingSphere()
    }

    report(realDelta, date, shipState.position, shipState.velocity, plan)
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

// Default export enables React.lazy(() => import('./SimulatorCanvas')) in App.tsx.
export default SimulatorCanvas

function resolveSolarBodyPosition(
  bodyName: string,
  date: Date,
  bodyPositions: Map<string, Vector3>,
  fallbackResolver: ReturnType<typeof createEphemerisSolarBodyResolver>,
): Vector3 {
  if (bodyName === SUN.name) {
    return new Vector3(0, 0, 0)
  }

  return bodyPositions.get(bodyName) ?? fallbackResolver(bodyName, date)
}
