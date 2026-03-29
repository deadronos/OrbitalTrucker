import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import { INITIAL_SIMULATED_DATE, TIME_WARP_STEPS } from '../simulation/types'

/**
 * Manages the simulated date and orbit-epoch state.
 *
 * `simulatedDateRef` is mutated every frame for high-frequency reads (body
 * positions, metrics). `orbitEpoch` is a React state value that updates at
 * most once per 7 simulated days, triggering a re-render of orbit paths.
 */
export function useTimeSimulation(
  timeWarpIndex: number,
  timePaused: boolean,
): {
  simulatedDateRef: React.RefObject<Date>
  orbitEpoch: Date
} {
  const simulatedDateRef = useRef(new Date(INITIAL_SIMULATED_DATE))
  const orbitAccumulatorRef = useRef(0)
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
    const realDelta = Math.min(delta, 0.05)
    const warpDaysPerSecond = timePausedRef.current
      ? 0
      : TIME_WARP_STEPS[timeWarpIndexRef.current]

    if (warpDaysPerSecond > 0) {
      const date = simulatedDateRef.current
      date.setTime(date.getTime() + realDelta * warpDaysPerSecond * 86_400_000)
      orbitAccumulatorRef.current += realDelta * warpDaysPerSecond

      if (orbitAccumulatorRef.current >= 7) {
        orbitAccumulatorRef.current = 0
        setOrbitEpoch(new Date(date))
      }
    }
  })

  return { simulatedDateRef, orbitEpoch }
}
