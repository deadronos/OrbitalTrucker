import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppShell } from '../../src/App'
import type { SimulatorCanvasProps } from '../../src/components/SimulatorCanvas'

function StubScene({
  onMetricsChange,
  selectedBodyName,
}: SimulatorCanvasProps) {
  useEffect(() => {
    onMetricsChange({
      simulatedDate: new Date('2026-03-29T12:00:00.000Z'),
      shipSpeedKmPerSecond: 42.4,
      heliocentricDistanceAu: 1.04,
      targetDistanceAu: selectedBodyName === 'Pluto' ? 34.95 : 2.03,
    })
  }, [onMetricsChange, selectedBodyName])

  return <div data-testid="stub-scene" />
}

describe('AppShell', () => {
  it('renders scene metrics and reacts to target selection', async () => {
    const user = userEvent.setup()

    render(<AppShell SceneComponent={StubScene} />)

    expect(screen.getByTestId('stub-scene')).toBeInTheDocument()
    expect(screen.getByText('42.4 km/s')).toBeInTheDocument()
    expect(screen.getByText('2.03 AU')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pluto' }))

    expect(screen.getByText('34.95 AU')).toBeInTheDocument()
    expect(screen.getByTestId('target-pluto')).toHaveClass('active')
  })
})
