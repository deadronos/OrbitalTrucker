import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ControlPanel } from '../../src/components/ControlPanel'
import { INITIAL_METRICS } from '../../src/simulation/types'
import { getLocationCatalog } from '../../src/world/locations'

describe('ControlPanel', () => {
  it('renders destination options and forwards selection changes by stable id', () => {
    const onSelectLocation = vi.fn()

    render(
      <ControlPanel
        destinations={getLocationCatalog()}
        metrics={{
          ...INITIAL_METRICS,
          autonomousPhase: 'cruising',
          plannerStatus: 'future-intercept',
        }}
        onSelectLocation={onSelectLocation}
        selectedLocationId="earth"
        timeWarpDaysPerSecond={0.25}
      />,
    )

    fireEvent.change(screen.getByLabelText('Current destination'), {
      target: { value: 'mars-high-port' },
    })

    expect(onSelectLocation).toHaveBeenCalledWith('mars-high-port')
    expect(screen.getByText('Earth')).toBeInTheDocument()
  })

  it('describes autonomous route control instead of manual piloting hints', () => {
    render(
      <ControlPanel
        destinations={getLocationCatalog()}
        metrics={{
          ...INITIAL_METRICS,
          autonomousPhase: 'acquiring',
          plannerStatus: 'future-intercept',
        }}
        onSelectLocation={vi.fn()}
        selectedLocationId="earth"
        timeWarpDaysPerSecond={0.25}
      />,
    )

    expect(screen.getByText('Destination-driven bridge')).toBeInTheDocument()
    expect(screen.getByText('Autonomy: Acquiring course')).toBeInTheDocument()
    expect(screen.getByText('Planner: Future intercept')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The cyan ring marks the destination now, and the amber marker shows the predicted intercept fix the ship is leading toward.',
      ),
    ).toBeInTheDocument()
  })
})
