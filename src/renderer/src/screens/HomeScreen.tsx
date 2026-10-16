import { useState } from 'react'
import type { Profile } from '../../../shared/api'
import { examDue } from '../../../shared/assessment'
import { LEVELS, type Course, type Level } from '../../../shared/content'
import { minutesSince, planGoal, studyStats } from '../../../shared/goal'
import type { Mode, ProfileProgress } from '../../../shared/progress'
import { DURATIONS, type Duration } from '../../../shared/session'
import TodayGoal from '../components/TodayGoal'
import { describePosition } from '../flow'

type Props = {
  profile: Profile
  course: Course
  progress: ProfileProgress
  onStart(mode: Mode, minutes: Duration): void
  onExam(mode: Mode, level: Level): void
  onGoal(): void
  onSwitchProfile(): void
  onAiSettings(): void
}

export default function HomeScreen({
  profile,
  course,
  progress,
  onStart,
  onExam,
  onGoal,
  onSwitchProfile,
  onAiSettings
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('solo')
  const where = describePosition(course, progress.position)
  const pending = progress.errorLog.filter((e) => !e.resolved).length
  const due = examDue(progress, course)
  const next = due && LEVELS[LEVELS.indexOf(due) + 1]
  const { goal } = progress
  const now = new Date()
  const stats = studyStats(progress.sessions, now)
  const plan =
    goal &&
    planGoal({
      level: progress.level,
      target: goal.target,
      months: goal.months,
      daysPerWeek: goal.daysPerWeek,
      studiedMinutes: minutesSince(progress.sessions, goal.createdAt)
    })
  // The duration closest to what is left for today, capped at 60 min.
  const want = plan && Math.min(Math.max(plan.minutesPerDay - stats.todayMinutes, 0), 60)
  const suggested =
    plan && plan.feasibility !== 'alcancada'
      ? DURATIONS.reduce((a, b) => (Math.abs(b - want!) < Math.abs(a - want!) ? b : a))
      : null
  return (
    <main className="screen">
      <header className="row">
        <h1>Olá, {profile.name}!</h1>
        <button type="button" className="btn btn-secondary" onClick={onSwitchProfile}>
          Trocar perfil
        </button>
      </header>
      {goal && plan && (
        <TodayGoal goal={goal} plan={plan} stats={stats} now={now} onEdit={onGoal} />
      )}
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
        {suggested && <p className="muted">Sugerido para a sua meta hoje: {suggested} min</p>}
        <div className="durations">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`btn ${!suggested || d === suggested ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onStart(mode, d)}
            >
              {d} min
            </button>
          ))}
        </div>
      </section>
      <div className="actions">
        {!goal && (
          <button type="button" className="btn btn-secondary" onClick={onGoal}>
            Minha meta
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onAiSettings}>
          Configurações da IA
        </button>
      </div>
    </main>
  )
}
