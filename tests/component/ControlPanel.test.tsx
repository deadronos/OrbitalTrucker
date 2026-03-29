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
        onOrientToTarget={vi.fn()}
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

  it('calls onOrientToTarget when the orient button is clicked', () => {
    const onOrientToTarget = vi.fn()

    render(
      <ControlPanel
        destinations={getLocationCatalog()}
        onOrientToTarget={onOrientToTarget}
        onSelectLocation={vi.fn()}
        selectedLocationId="earth"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Orient to target' }))

    expect(onOrientToTarget).toHaveBeenCalledOnce()
  })
})
