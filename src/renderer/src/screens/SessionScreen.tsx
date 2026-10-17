import { useEffect, useState } from 'react'
import type { Course } from '../../../shared/content'
import type { FinalVerdict } from '../../../shared/matcher'
import {
  completeBlock,
  recordAttempt,
  soloSinceLastGuided,
  type Mode,
  type ProfileProgress,
  type SessionRecord
} from '../../../shared/progress'
import { recordPractice } from '../../../shared/practice'
import { buildSession, type Duration, type SessionPlan } from '../../../shared/session'
import ExerciseView from '../components/ExerciseView'
import PhaseTimer from '../components/PhaseTimer'
import SoloRecap from '../components/SoloRecap'
import TeacherPanel from '../components/TeacherPanel'
import { flattenPlan, formatClock } from '../flow'

type Props = {
  mode: Mode
  course: Course
  progress: ProfileProgress
  minutes: Duration
  /** A ready-made plan ("Praticar mais"); without it the lesson plan is built here. */
  plan?: SessionPlan
  onProgress(p: ProfileProgress): void
  onEnd(record: SessionRecord): void
}

export default function SessionScreen({
  mode,
  course,
  progress,
  minutes,
  plan: ready,
  onProgress,
  onEnd
}: Props): React.JSX.Element {
  // The plan is fixed at the start; progress keeps changing as answers come in.
  const [plan] = useState(() => ready ?? buildSession(course, progress, minutes))
  const [practiceIds] = useState(
    () => new Set(course.units.flatMap((u) => u.practice.map((e) => e.id)))
  )
  const [items] = useState(() => flattenPlan(course, plan))
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [index, setIndex] = useState(0)
  useEffect(() => window.scrollTo(0, 0), [index])
  const [blocksDone, setBlocksDone] = useState<string[]>([])
  const [errors, setErrors] = useState(0)
  // Computed once: the recap is about the time before this lesson.
  const [recap] = useState(() => (mode === 'guided' ? soloSinceLastGuided(progress) : null))
  const [recapSeen, setRecapSeen] = useState(
    !recap || (!recap.sessions.length && !recap.blocksDone.length && !recap.openErrors.length)
  )

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const item = items[index]
  const remaining = minutes * 60 - (now - startedAt) / 1000

  function handleFinal(verdict: FinalVerdict, transcript: string): void {
    const at = new Date().toISOString()
    let p = recordAttempt(progress, {
      exerciseId: item.exercise.id,
      unitId: item.unitId,
      transcript,
      verdict,
      at
    })
    if (practiceIds.has(item.exercise.id)) p = recordPractice(p, item.exercise.id, verdict, at)
    if (item.completesBlockId) {
      p = completeBlock(p, course, item.completesBlockId)
      setBlocksDone([...blocksDone, item.completesBlockId])
    }
    onProgress(p)
    if (verdict === 'error') setErrors(errors + 1)
    setIndex(index + 1)
  }

  function end(): void {
    onEnd({
      at: new Date(startedAt).toISOString(),
      mode,
      minutes: Math.round((Date.now() - startedAt) / 60000),
      blocksDone,
      errors
    })
  }

  const unit = item && course.units.find((u) => u.id === item.unitId)
  return (
    <main className="screen session">
      <header className="session-bar">
        <div>
          {item ? (
            <>
              <strong>{item.label}</strong>
              {unit && <span className="muted"> · {unit.title_pt}</span>}
              <div className="muted small">
                Exercício {index + 1} de {items.length}
              </div>
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${(index / items.length) * 100}%` }} />
              </div>
            </>
          ) : (
            <strong>Sessão {mode === 'solo' ? 'solo' : 'guiada'}</strong>
          )}
        </div>
        {mode === 'guided' && item && recapSeen ? (
          <PhaseTimer
            key={item.stepIndex}
            phase={item.label}
            phaseMinutes={item.stepMinutes}
            now={now}
            sessionRemaining={remaining}
          />
        ) : (
          <div className={`timer${remaining < 0 ? ' timer-over' : ''}`} role="timer">
            {remaining >= 0
              ? `Faltam ${formatClock(remaining)}`
              : `Tempo esgotado (${formatClock(remaining)}) · encerre quando quiser`}
          </div>
        )}
        <button type="button" className="btn btn-secondary" onClick={end}>
          Encerrar sessão
        </button>
      </header>
      {plan.examDue && (
        <p className="notice notice-warn">
          Sessão de reforço — a prova do {plan.examDue} está liberada no início
        </p>
      )}

      {!recapSeen && recap ? (
        <SoloRecap
          recap={recap}
          onStart={() => {
            // The clock starts when the lesson does, not while the recap is read.
            const t = Date.now()
            setStartedAt(t)
            setNow(t)
            setRecapSeen(true)
          }}
        />
      ) : item ? (
        <>
          <ExerciseView key={index} exercise={item.exercise} mode={mode} onFinal={handleFinal} />
          {mode === 'guided' && (
            <TeacherPanel key={`teacher-${index}`} block={item.block} exercise={item.exercise} />
          )}
        </>
      ) : (
        <section className="panel" aria-live="polite">
          <h2>
            {items.length ? 'Você terminou os exercícios desta sessão!' : 'Nada para praticar.'}
          </h2>
          {plan.courseComplete && <p>Você chegou ao fim do curso disponível. Parabéns!</p>}
          <button type="button" className="btn btn-primary" autoFocus onClick={end}>
            Ver resumo
          </button>
        </section>
      )}
    </main>
  )
}
