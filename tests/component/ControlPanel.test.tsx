import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ControlPanel } from '../../src/components/ControlPanel'

describe('ControlPanel', () => {
  it('renders target buttons and forwards selection changes', () => {
    const onSelectBody = vi.fn()

    render(
      <ControlPanel
        onOrientToTarget={vi.fn()}
        onSelectBody={onSelectBody}
        selectedBodyName="Earth"
        targetNames={['Sun', 'Earth', 'Mars']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mars' }))

    expect(onSelectBody).toHaveBeenCalledWith('Mars')
    expect(screen.getByTestId('target-earth')).toHaveClass('active')
  })

  it('calls onOrientToTarget when the orient button is clicked', () => {
    const onOrientToTarget = vi.fn()

    render(
      <ControlPanel
        onOrientToTarget={onOrientToTarget}
        onSelectBody={vi.fn()}
        selectedBodyName="Earth"
        targetNames={['Sun', 'Earth', 'Mars']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Orient to target' }))

    expect(onOrientToTarget).toHaveBeenCalledOnce()
  })
})
