import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MetricsPanel } from '../../src/components/MetricsPanel'
import type { SimulationMetrics } from '../../src/simulation/types'

const METRICS: SimulationMetrics = {
  simulatedDate: new Date('2026-03-30T08:00:00.000Z'),
  shipSpeedKmPerSecond: 42.4,
  heliocentricDistanceAu: 1.04,
  currentTargetDistanceAu: 2.03,
  plannedDistanceAu: 2.08,
  plannerStatus: 'future-intercept',
  autonomousPhase: 'braking',
  targetBearingDeg: 12.5,
  etaDays: 14.5,
  interceptTimeSeconds: 604_800,
  targetMotionDuringInterceptAu: 0.004,
}

describe('MetricsPanel', () => {
  it('renders autonomous travel status and paused simulation controls', () => {
    render(
      <MetricsPanel
        metrics={METRICS}
        onFasterTime={vi.fn()}
        onPauseToggle={vi.fn()}
        onSlowerTime={vi.fn()}
        timeWarpDaysPerSecond={0}
      />,
    )

    expect(screen.getByText('Travel status')).toBeInTheDocument()
    expect(screen.getByText('Braking')).toBeInTheDocument()
    expect(screen.getByText('Future intercept')).toBeInTheDocument()
    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resume sim' }),
    ).toBeInTheDocument()
  })
})
