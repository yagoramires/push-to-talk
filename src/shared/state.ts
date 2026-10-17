import type { AppState } from './api'

export const emptyState = (): AppState => ({ version: 1, profiles: [], progress: {} })

export function isState(v: unknown): v is AppState {
  const s = v as AppState | null
  return (
    typeof s === 'object' &&
    s !== null &&
    s.version === 1 &&
    Array.isArray(s.profiles) &&
    typeof s.progress === 'object' &&
    s.progress !== null
  )
}
