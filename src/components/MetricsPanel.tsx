import {
  formatAutonomousPhase,
  formatDistanceAu,
  formatDurationSeconds,
  formatEtaDays,
  formatShipSpeedKmPerSecond,
  formatShortUtcDate,
  formatTimeWarp,
  formatTransferPlannerStatus,
  formatUtcDate,
} from '../simulation/formatters'
import type { SimulationMetrics } from '../simulation/types'
import { Button } from './ui/button'
import { Card } from './ui/card'

type MetricsPanelProps = {
  metrics: SimulationMetrics
  timeWarpDaysPerSecond: number
  onSlowerTime: () => void
  onPauseToggle: () => void
  onFasterTime: () => void
}

export function MetricsPanel({
  metrics,
  timeWarpDaysPerSecond,
  onSlowerTime,
  onPauseToggle,
  onFasterTime,
}: MetricsPanelProps) {
  const pauseButtonLabel =
    timeWarpDaysPerSecond === 0 ? 'Resume sim' : 'Pause sim'

  return (
    <Card className="pointer-events-auto border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-50">
          Travel status
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
          live
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricCell
          className="col-span-2"
          label="Autonomous state"
          value={formatAutonomousPhase(metrics.autonomousPhase)}
        />
        <MetricCell
          label="Planner status"
          value={formatTransferPlannerStatus(metrics.plannerStatus)}
        />
        <MetricCell label="ETA" value={formatEtaDays(metrics.etaDays)} />
        <MetricCell
          className="col-span-2"
          label="Simulated date"
          value={formatUtcDate(metrics.simulatedDate)}
        />
        <MetricCell
          label="Ship speed"
          value={formatShipSpeedKmPerSecond(metrics.shipSpeedKmPerSecond)}
        />
        <MetricCell
          label="Heliocentric radius"
          value={formatDistanceAu(metrics.heliocentricDistanceAu)}
        />
        <MetricCell
          label="Current range"
          value={formatDistanceAu(metrics.currentTargetDistanceAu)}
        />
        <MetricCell
          label="Planned range"
          value={formatDistanceAu(metrics.plannedDistanceAu)}
        />
        <MetricCell
          label="Intercept window"
          value={formatDurationSeconds(metrics.interceptTimeSeconds)}
        />
        {metrics.interceptDate ? (
          <MetricCell
            className="col-span-2"
            label="Intercept fix"
            value={formatShortUtcDate(metrics.interceptDate)}
          />
        ) : null}
        <MetricCell
          label="Target drift"
          value={formatDistanceAu(metrics.targetMotionDuringInterceptAu)}
        />
        <MetricCell
          label="Bearing"
          value={`${metrics.targetBearingDeg.toFixed(1)}°`}
        />
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Simulation rate
            </p>
            <p className="mt-1 text-sm font-medium text-slate-50">
              {formatTimeWarp(timeWarpDaysPerSecond)}
            </p>
          </div>
          <p className="max-w-32 text-right text-xs leading-5 text-slate-400">
            Adjust sim speed without breaking the autonomous travel loop.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button onClick={onSlowerTime} size="sm" variant="secondary">
            Slower
          </Button>
          <Button onClick={onPauseToggle} size="sm" variant="secondary">
            {pauseButtonLabel}
          </Button>
          <Button onClick={onFasterTime} size="sm" variant="secondary">
            Faster
          </Button>
        </div>
      </div>
    </Card>
  )
}

type MetricCellProps = {
  className?: string
  label: string
  value: string
}

function MetricCell({ className, label, value }: MetricCellProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <span className="mt-1 block text-sm font-medium leading-5 text-slate-50">
        {value}
      </span>
    </div>
  )
}
