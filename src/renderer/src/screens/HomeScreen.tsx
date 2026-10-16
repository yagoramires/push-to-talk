import { useState } from 'react'
import type { Profile } from '../../../shared/api'
import type { Course } from '../../../shared/content'
import type { Mode, ProfileProgress } from '../../../shared/progress'
import { DURATIONS, type Duration } from '../../../shared/session'
import { describePosition } from '../flow'

type Props = {
  profile: Profile
  course: Course
  progress: ProfileProgress
  onStart(mode: Mode, minutes: Duration): void
  onSwitchProfile(): void
  onAiSettings(): void
}

export default function HomeScreen({
  profile,
  course,
  progress,
  onStart,
  onSwitchProfile,
  onAiSettings
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('solo')
  const where = describePosition(course, progress.position)
  const pending = progress.errorLog.filter((e) => !e.resolved).length
  return (
    <main className="screen">
      <header className="row">
        <h1>Olá, {profile.name}!</h1>
        <button type="button" className="btn btn-secondary" onClick={onSwitchProfile}>
          Trocar perfil
        </button>
      </header>
      <section className="panel">
        <p className="muted">Você está em</p>
        <p className="big">{where ?? 'Curso concluído'}</p>
        {pending > 0 && (
          <p className="muted">
            {pending} {pending === 1 ? 'erro' : 'erros'} para revisar no começo da sessão
          </p>
        )}
      </section>
      <section className="panel">
        <h2 id="mode-label">Modo</h2>
        <div className="segmented" role="radiogroup" aria-labelledby="mode-label">
          {(['solo', 'guided'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={`btn btn-option${mode === m ? ' selected' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'solo' ? 'Solo' : 'Guiado'}
            </button>
          ))}
        </div>
        <h2>Quanto tempo você tem?</h2>
        <div className="durations">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="btn btn-primary"
              onClick={() => onStart(mode, d)}
            >
              {d} min
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="btn btn-secondary" onClick={onAiSettings}>
        Configurações da IA
      </button>
    </main>
  )
}
