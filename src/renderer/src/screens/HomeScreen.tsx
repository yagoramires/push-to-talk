import { useState } from 'react'
import type { Profile } from '../../../shared/api'
import { examDue } from '../../../shared/assessment'
import { LEVELS, type Course, type Level } from '../../../shared/content'
import type { Mode, ProfileProgress } from '../../../shared/progress'
import { DURATIONS, type Duration } from '../../../shared/session'
import { describePosition } from '../flow'

type Props = {
  profile: Profile
  course: Course
  progress: ProfileProgress
  onStart(mode: Mode, minutes: Duration): void
  onExam(mode: Mode, level: Level): void
  onSwitchProfile(): void
  onAiSettings(): void
}

export default function HomeScreen({
  profile,
  course,
  progress,
  onStart,
  onExam,
  onSwitchProfile,
  onAiSettings
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('solo')
  const where = describePosition(course, progress.position)
  const pending = progress.errorLog.filter((e) => !e.resolved).length
  const due = examDue(progress, course)
  const next = due && LEVELS[LEVELS.indexOf(due) + 1]
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
        <p className="big">{where ?? (due ? `Fim das unidades do ${due}` : 'Curso concluído')}</p>
        {pending > 0 && (
          <p className="muted">
            {pending} {pending === 1 ? 'erro' : 'erros'} para revisar no começo da sessão
          </p>
        )}
      </section>
      {due && (
        <section className="panel panel-highlight" aria-labelledby="exam-label">
          <h2 id="exam-label">
            Você terminou as unidades do {due}! Faça a prova final para{' '}
            {next ? `passar ao ${next}` : 'concluir o curso'}
          </h2>
          <p className="muted">
            As sessões abaixo continuam disponíveis como reforço. Você pode fazer a prova quando
            quiser.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => onExam('solo', due)}>
              Fazer a prova (solo)
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onExam('guided', due)}>
              Fazer a prova (guiado)
            </button>
          </div>
        </section>
      )}
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
