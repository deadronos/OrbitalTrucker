import { useEffect, useMemo, useState, type ComponentType } from 'react'

import { ControlPanel } from './components/ControlPanel'
import { LegendPanel } from './components/LegendPanel'
import { MetricsPanel } from './components/MetricsPanel'
import {
  INITIAL_METRICS,
  TIME_WARP_STEPS,
  type SimulationMetrics,
} from './simulation/types'
import {
  SimulatorCanvas,
  type SimulatorCanvasProps,
} from './components/SimulatorCanvas'
import { SUN, SOLAR_BODIES } from './solar-data'

type AppShellProps = {
  SceneComponent?: ComponentType<SimulatorCanvasProps>
}

export function AppShell({ SceneComponent = SimulatorCanvas }: AppShellProps) {
  const [metrics, setMetrics] = useState<SimulationMetrics>(INITIAL_METRICS)
  const [selectedBodyName, setSelectedBodyName] = useState('Earth')
  const [timeWarpIndex, setTimeWarpIndex] = useState(3)
  const [timePaused, setTimePaused] = useState(false)
  const [autoOrientTrigger, setAutoOrientTrigger] = useState(0)

  const targetNames = useMemo(
    () => [SUN.name, ...SOLAR_BODIES.map((body) => body.name)],
    [],
  )
  const legendBodies = useMemo(
    () =>
      SOLAR_BODIES.map((body) => ({
        name: body.name,
        semiMajorAxisAu: body.elements.semiMajorAxisAu.base,
        orbitalPeriodDays: body.orbitalPeriodDays,
      })),
    [],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'BracketLeft') {
        setTimePaused(false)
        setTimeWarpIndex((current) => Math.max(0, current - 1))
      } else if (event.code === 'BracketRight') {
        setTimePaused(false)
        setTimeWarpIndex((current) =>
          Math.min(TIME_WARP_STEPS.length - 1, current + 1),
        )
      } else if (event.code === 'KeyT') {
        setAutoOrientTrigger((n) => n + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="sim-shell">
      <SceneComponent
        autoOrientTrigger={autoOrientTrigger}
        selectedBodyName={selectedBodyName}
        timePaused={timePaused}
        timeWarpIndex={timeWarpIndex}
        onMetricsChange={setMetrics}
      />

      <div className="overlay">
        <section className="panel intro-panel">
          <p className="eyebrow">OrbitalTrucker / react-r3f port</p>
          <h1>Freighter bridge</h1>
          <p>
            Fly a placeholder cargo freighter through a heliocentric map with
            the Sun, all major planets, and Pluto using Keplerian orbital
            elements at realistic solar-system distances.
          </p>
          <p className="muted">
            The scene now runs through React, React Three Fiber, and Drei
            helpers while keeping AU scale distances, exaggerated visible body
            sizes, and lightweight but plausible orbital mechanics.
          </p>
        </section>

        <MetricsPanel
          metrics={metrics}
          selectedBodyName={selectedBodyName}
          timeWarpDaysPerSecond={
            timePaused ? 0 : TIME_WARP_STEPS[timeWarpIndex]
          }
          onFasterTime={() => {
            setTimePaused(false)
            setTimeWarpIndex((current) =>
              Math.min(TIME_WARP_STEPS.length - 1, current + 1),
            )
          }}
          onPauseToggle={() => {
            setTimePaused((current) => !current)
          }}
          onSlowerTime={() => {
            setTimePaused(false)
            setTimeWarpIndex((current) => Math.max(0, current - 1))
          }}
        />

        <ControlPanel
          selectedBodyName={selectedBodyName}
          targetNames={targetNames}
          onOrientToTarget={() => setAutoOrientTrigger((n) => n + 1)}
          onSelectBody={setSelectedBodyName}
        />

        <LegendPanel bodies={legendBodies} />
      </div>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
