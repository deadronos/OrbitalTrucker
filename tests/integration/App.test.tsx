import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppShell } from '../../src/App'
import type { SimulatorCanvasProps } from '../../src/components/SimulatorCanvas'

function StubScene({
  onMetricsChange,
  selectedLocationId,
}: SimulatorCanvasProps) {
  useEffect(() => {
    onMetricsChange({
      simulatedDate: new Date('2026-03-29T12:00:00.000Z'),
      shipSpeedKmPerSecond: 42.4,
      heliocentricDistanceAu: 1.04,
      currentTargetDistanceAu: selectedLocationId === 'pluto' ? 34.95 : 2.03,
      plannedDistanceAu: selectedLocationId === 'pluto' ? 36.4 : 2.08,
      plannerStatus:
        selectedLocationId === 'pluto'
          ? 'future-intercept'
          : 'current-position',
      autonomousPhase:
        selectedLocationId === 'pluto' ? 'cruising' : 'acquiring',
      targetBearingDeg: 45,
      etaDays: selectedLocationId === 'pluto' ? 365 : null,
      interceptTimeSeconds:
        selectedLocationId === 'pluto' ? 100 * 86_400 : null,
      interceptDate:
        selectedLocationId === 'pluto'
          ? new Date('2026-07-07T12:00:00.000Z')
          : null,
      targetMotionDuringInterceptAu: selectedLocationId === 'pluto' ? 1.45 : 0,
    })
  }, [onMetricsChange, selectedLocationId])

  return <div data-testid="stub-scene" />
}

describe('AppShell', () => {
  it('renders scene metrics and reacts to target selection', async () => {
    const user = userEvent.setup()

    render(<AppShell SceneComponent={StubScene} />)

    expect(screen.getByTestId('stub-scene')).toBeInTheDocument()
    expect(screen.getByText('42.4 km/s')).toBeInTheDocument()
    expect(screen.getByText('2.03 AU')).toBeInTheDocument()
    expect(screen.getByText('2.08 AU')).toBeInTheDocument()
    expect(screen.getByText('Acquiring course')).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText('Current destination'),
      'pluto',
    )

    expect(screen.getByText('34.95 AU')).toBeInTheDocument()
    expect(screen.getByText('36.40 AU')).toBeInTheDocument()
    expect(screen.getByText('Future intercept')).toBeInTheDocument()
    expect(screen.getByText('Cruising')).toBeInTheDocument()
    expect(screen.getByText('100.0 d')).toBeInTheDocument()
    expect(screen.getByText('Tue, 07 Jul 2026 12:00 UTC')).toBeInTheDocument()
    expect(screen.getByTestId('destination-select')).toHaveValue('pluto')
  })
})
