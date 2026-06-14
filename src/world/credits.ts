export const CREDITS_STORAGE_KEY = 'orbitaltrucker.credits'

/**
 * Reads the persisted credit balance from `localStorage`. Returns 0 when
 * the entry is missing, non-numeric, fractional, or negative. The credit
 * balance is always a non-negative integer.
 */
export function loadCredits(): number {
  if (typeof window === 'undefined') return 0

  const raw = window.localStorage.getItem(CREDITS_STORAGE_KEY)
  if (raw === null) return 0

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0
  if (parsed < 0) return 0
  if (!Number.isInteger(parsed)) return 0

  return parsed
}

/**
 * Persists the credit balance to `localStorage`. The value is sanitized
 * to a non-negative integer (fractional input is truncated, negative
 * input is clamped to zero) so the stored value can always be parsed
 * back via `loadCredits`.
 */
export function saveCredits(value: number): void {
  if (typeof window === 'undefined') return

  const sanitized = Math.max(0, Math.trunc(value))
  window.localStorage.setItem(CREDITS_STORAGE_KEY, String(sanitized))
}

/**
 * Pure helper: returns the credit balance that results from awarding
 * `reward` credits on top of the current `balance`. The reward must be
 * a non-negative integer; the result is also a non-negative integer.
 */
export function awardCredits(balance: number, reward: number): number {
  return Math.max(0, Math.trunc(balance) + Math.max(0, Math.trunc(reward)))
}
