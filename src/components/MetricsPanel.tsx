import {
  formatDistanceAu,
  formatEtaDays,
  formatShipSpeedKmPerSecond,
  formatTimeWarp,
  formatTransferPlannerStatus,
  formatUtcDate,
} from '../simulation/formatters'
import type { SimulationMetrics } from '../simulation/types'
import { Button } from './ui/button'
import { Card } from './ui/card'

type MetricsPanelProps = {
  metrics: SimulationMetrics
  selectedLocationName: string
  timeWarpDaysPerSecond: number
  onSlowerTime: () => void
  onPauseToggle: () => void
  onFasterTime: () => void
}

export function MetricsPanel({
  metrics,
  selectedLocationName,
  timeWarpDaysPerSecond,
  onSlowerTime,
  onPauseToggle,
  onFasterTime,
}: MetricsPanelProps) {
  return (
    <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Telemetry
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          live
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricCell
          label="Simulated date"
          value={formatUtcDate(metrics.simulatedDate)}
        />
        <MetricCell
          label="Time warp"
          value={formatTimeWarp(timeWarpDaysPerSecond)}
        />
        <MetricCell
          label="Ship speed"
          value={formatShipSpeedKmPerSecond(metrics.shipSpeedKmPerSecond)}
        />
        <MetricCell
          label="Heliocentric radius"
          value={formatDistanceAu(metrics.heliocentricDistanceAu)}
        />
        <MetricCell label="Destination" value={selectedLocationName} />
        <MetricCell
          label="Planner"
          value={formatTransferPlannerStatus(metrics.plannerStatus)}
        />
        <MetricCell
          label="Target range"
          value={formatDistanceAu(metrics.currentTargetDistanceAu)}
        />
        <MetricCell
          label="Planned range"
          value={formatDistanceAu(metrics.plannedDistanceAu)}
        />
        <MetricCell
          label="Bearing"
          value={`${metrics.targetBearingDeg.toFixed(1)}°`}
        />
        <MetricCell label="ETA" value={formatEtaDays(metrics.etaDays)} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button onClick={onSlowerTime} size="sm" variant="secondary">
          Slower time
        </Button>
        <Button onClick={onPauseToggle} size="sm" variant="secondary">
          Pause / resume
        </Button>
        <Button onClick={onFasterTime} size="sm" variant="secondary">
          Faster time
        </Button>
      </div>
    </Card>
  )
}

type MetricCellProps = {
  label: string
  value: string
}

function MetricCell({ label, value }: MetricCellProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <span className="mt-1 block text-sm font-medium leading-5 text-slate-50">
        {value}
      </span>
    </div>
  )
}
