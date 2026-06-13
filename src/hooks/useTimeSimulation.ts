import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import {
  advanceOrbitEpochCadence,
  createOrbitEpochCadenceState,
  shouldEmitOrbitEpoch,
} from '../simulation/orbit-epoch-cadence'
import { INITIAL_SIMULATED_DATE, TIME_WARP_STEPS } from '../simulation/types'

/**
 * Maximum real-time `delta` that we will fold into a single frame. The
 * Three.js renderer can hand us very large deltas on tab focus / tab return
 * events; we clamp them so the simulated clock does not jump arbitrarily far
 * on those events.
 */
const MAX_FRAME_DELTA_SEC = 0.05

/**
 * Manages the simulated date and orbit-epoch state.
 *
 * `simulatedDateRef` is mutated every frame for high-frequency reads (body
 * positions, metrics). `orbitEpoch` is a React state value that updates
 * when the simulated-day cadence says a polyline rebuild is due, but is
 * additionally throttled by a real-time cap (5 Hz by default) so the
 * polylines do not rebuild on every frame at high warp. See issue #40 and
 * ADR 016.
 */
export function useTimeSimulation(
  timeWarpIndex: number,
  timePaused: boolean,
): {
  simulatedDateRef: React.RefObject<Date>
  orbitEpoch: Date
} {
  const simulatedDateRef = useRef(new Date(INITIAL_SIMULATED_DATE))
  const cadenceRef = useRef(createOrbitEpochCadenceState())
  const lastOrbitUpdateSecRef = useRef<number | null>(null)
  const elapsedRealTimeRef = useRef(0)
  const [orbitEpoch, setOrbitEpoch] = useState(
    () => new Date(INITIAL_SIMULATED_DATE),
  )
  const timeWarpIndexRef = useRef(timeWarpIndex)
  const timePausedRef = useRef(timePaused)

  useEffect(() => {
    timeWarpIndexRef.current = timeWarpIndex
  }, [timeWarpIndex])

  useEffect(() => {
    timePausedRef.current = timePaused
  }, [timePaused])

  useFrame((_, delta) => {
    const realDelta = Math.min(delta, MAX_FRAME_DELTA_SEC)
    const warpDaysPerSecond = timePausedRef.current
      ? 0
      : TIME_WARP_STEPS[timeWarpIndexRef.current]

    if (warpDaysPerSecond > 0) {
      const date = simulatedDateRef.current
      date.setTime(date.getTime() + realDelta * warpDaysPerSecond * 86_400_000)

      const simulatedDaysAdvanced = realDelta * warpDaysPerSecond
      const { nextState, crossings } = advanceOrbitEpochCadence(
        cadenceRef.current,
        simulatedDaysAdvanced,
      )
      cadenceRef.current = nextState

      if (
        shouldEmitOrbitEpoch(
          crossings,
          lastOrbitUpdateSecRef.current,
          elapsedRealTimeRef.current,
        )
      ) {
        lastOrbitUpdateSecRef.current = elapsedRealTimeRef.current
        setOrbitEpoch(new Date(date))
      }
    }

    elapsedRealTimeRef.current += realDelta
  }, -3)

  return { simulatedDateRef, orbitEpoch }
}
