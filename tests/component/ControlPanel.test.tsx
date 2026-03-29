import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ControlPanel } from '../../src/components/ControlPanel'
import { getLocationCatalog } from '../../src/world/locations'

describe('ControlPanel', () => {
  it('renders destination options and forwards selection changes by stable id', () => {
    const onSelectLocation = vi.fn()

    render(
      <ControlPanel
        destinations={getLocationCatalog()}
        onSelectLocation={onSelectLocation}
        selectedLocationId="earth"
      />,
    )

    fireEvent.change(screen.getByLabelText('Destination'), {
      target: { value: 'mars-high-port' },
    })

    expect(onSelectLocation).toHaveBeenCalledWith('mars-high-port')
    expect(screen.getByText('Earth')).toBeInTheDocument()
  })

  it('describes autonomous route control instead of manual piloting hints', () => {
    render(
      <ControlPanel
        destinations={getLocationCatalog()}
        onSelectLocation={vi.fn()}
        selectedLocationId="earth"
      />,
    )

    expect(screen.getByText('Flight computer engaged')).toBeInTheDocument()
    expect(
      screen.getByText('Destination changes reroute live'),
    ).toBeInTheDocument()
  })
})
