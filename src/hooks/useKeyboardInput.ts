import { useEffect, useRef } from 'react'

/**
 * Tracks which keyboard keys are currently held down.
 * Returns a stable ref to a Set of KeyboardEvent.code strings.
 */
export function useKeyboardInput(): React.RefObject<Set<string>> {
  const keyStateRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keyStateRef.current.add(event.code)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keyStateRef.current.delete(event.code)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keyStateRef
}
