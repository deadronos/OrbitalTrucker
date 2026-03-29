import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type LazyExoticComponent } from 'react'

import { ControlPanel } from './components/ControlPanel'
import { LegendPanel } from './components/LegendPanel'
import { MetricsPanel } from './components/MetricsPanel'
import {
  INITIAL_METRICS,
  TIME_WARP_STEPS,
  type SimulationMetrics,
} from './simulation/types'
import type { SimulatorCanvasProps } from './components/SimulatorCanvas'
import { SUN, SOLAR_BODIES } from './solar-data'
import { Card } from './components/ui/card'

/**
 * Heavy 3D engine chunk (Three.js, R3F, Drei, all scene components) is loaded
 * lazily so it does not block the initial HUD render. The Suspense fallback
 * shows a matching dark background while the canvas module downloads.
 */
const SimulatorCanvas = lazy(() => import('./components/SimulatorCanvas'))

type AppShellProps = {
  SceneComponent?:
    | ComponentType<SimulatorCanvasProps>
    | LazyExoticComponent<ComponentType<SimulatorCanvasProps>>
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
    <div className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(46,_86,_142,_0.28),_transparent_35%),linear-gradient(180deg,_rgba(2,_4,_9,_0.78),_rgba(2,_4,_9,_0.98))] text-slate-50">
      <Suspense fallback={<div className="absolute inset-0 bg-[#020409]" />}>
        <SceneComponent
          autoOrientTrigger={autoOrientTrigger}
          selectedBodyName={selectedBodyName}
          timePaused={timePaused}
          timeWarpIndex={timeWarpIndex}
          onMetricsChange={setMetrics}
        />
      </Suspense>

      <aside className="pointer-events-none absolute inset-y-4 left-4 z-10 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto pr-1 sm:w-[19rem] lg:w-[20rem]">
        <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-cyan-200/80">
                OrbitalTrucker
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">
                Minimal bridge HUD
              </h1>
            </div>
            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-100/90">
              R3F
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The simulator stays full-screen; the HUD keeps navigation, telemetry,
            and orbit reference within quick-glance range.
          </p>
        </Card>

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
      </aside>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
