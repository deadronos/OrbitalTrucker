import {
  formatDistanceAu,
  formatEtaDays,
  formatShipSpeedKmPerSecond,
  formatTimeWarp,
  formatUtcDate,
} from '../simulation/formatters'
import type { SimulationMetrics } from '../simulation/types'

type MetricsPanelProps = {
  metrics: SimulationMetrics
  selectedBodyName: string
  timeWarpDaysPerSecond: number
  onSlowerTime: () => void
  onPauseToggle: () => void
  onFasterTime: () => void
}

export function MetricsPanel({
  metrics,
  selectedBodyName,
  timeWarpDaysPerSecond,
  onSlowerTime,
  onPauseToggle,
  onFasterTime,
}: MetricsPanelProps) {
  return (
    <section className="panel metrics-panel">
      <div className="metrics-grid">
        <div>
          <span className="label">Simulated date</span>
          <strong>{formatUtcDate(metrics.simulatedDate)}</strong>
        </div>
        <div>
          <span className="label">Time warp</span>
          <strong>{formatTimeWarp(timeWarpDaysPerSecond)}</strong>
        </div>
        <div>
          <span className="label">Ship speed</span>
          <strong>
            {formatShipSpeedKmPerSecond(metrics.shipSpeedKmPerSecond)}
          </strong>
        </div>
        <div>
          <span className="label">Heliocentric radius</span>
          <strong>{formatDistanceAu(metrics.heliocentricDistanceAu)}</strong>
        </div>
        <div>
          <span className="label">Target</span>
          <strong>{selectedBodyName}</strong>
        </div>
        <div>
          <span className="label">Range to target</span>
          <strong>{formatDistanceAu(metrics.targetDistanceAu)}</strong>
        </div>
        <div>
          <span className="label">Bearing to target</span>
          <strong>{metrics.targetBearingDeg.toFixed(1)}°</strong>
        </div>
        <div>
          <span className="label">ETA (straight-line)</span>
          <strong>{formatEtaDays(metrics.etaDays)}</strong>
        </div>
      </div>

      <div className="controls-row">
        <button onClick={onSlowerTime} type="button">
          Slower time
        </button>
        <button onClick={onPauseToggle} type="button">
          Pause / resume
        </button>
        <button onClick={onFasterTime} type="button">
          Faster time
        </button>
      </div>
    </section>
  )
}
