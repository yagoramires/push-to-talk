import { useState } from 'react'
import { formatClock } from '../flow'

type Props = {
  phase: string
  phaseMinutes: number
  /** Ticking clock (ms), shared with the session timer. */
  now: number
  sessionRemaining: number
}

/** Remount (key by step) for each phase so its clock restarts. Informational only: never advances the session. */
export default function PhaseTimer({
  phase,
  phaseMinutes,
  now,
  sessionRemaining
}: Props): React.JSX.Element {
  const [phaseStart] = useState(now)
  const phaseRemaining = phaseMinutes * 60 - (now - phaseStart) / 1000
  return (
    <div className="timer phase-timer" role="timer">
      <div>
        {phase}:{' '}
        {phaseRemaining >= 0
          ? `faltam ${formatClock(phaseRemaining)}`
          : `passou ${formatClock(phaseRemaining)}`}
      </div>
      <div className={sessionRemaining < 0 ? 'timer-over' : 'muted small'}>
        {sessionRemaining >= 0
          ? `Sessão: faltam ${formatClock(sessionRemaining)}`
          : `Tempo esgotado (${formatClock(sessionRemaining)}) · encerre quando quiser`}
      </div>
    </div>
  )
}
