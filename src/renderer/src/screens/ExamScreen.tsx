import { useEffect, useState } from 'react'
import { applyExamResult } from '../../../shared/assessment'
import type { Course, LevelExam, Skill } from '../../../shared/content'
import type { FinalVerdict } from '../../../shared/matcher'
import {
  recordSession,
  type ExamRecord,
  type Mode,
  type ProfileProgress
} from '../../../shared/progress'
import ExerciseView from '../components/ExerciseView'
import { formatClock, SKILL_LABELS } from '../flow'

type Props = {
  mode: Mode
  course: Course
  exam: LevelExam
  progress: ProfileProgress
  onDone(progress: ProfileProgress, record: ExamRecord): void
  onQuit(): void
}

type Answer = {
  exerciseId: string
  skill: Skill
  unitId?: string
  correct: boolean
  transcript: string
}

/** Nothing is saved until the last item: quitting midway leaves the progress as it was. */
export default function ExamScreen({
  mode,
  course,
  exam,
  progress,
  onDone,
  onQuit
}: Props): React.JSX.Element {
  const [items] = useState(() =>
    exam.parts.flatMap((part, partIndex) => part.items.map((item) => ({ item, partIndex })))
  )
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const [index, setIndex] = useState(0)
  useEffect(() => window.scrollTo(0, 0), [index])
  const [answers, setAnswers] = useState<Answer[]>([])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const { item, partIndex } = items[index]
  const part = exam.parts[partIndex]
  const remaining = exam.minutes * 60 - (now - startedAt) / 1000

  function handleFinal(verdict: FinalVerdict, transcript: string): void {
    const all = [
      ...answers,
      {
        exerciseId: item.exercise.id,
        skill: item.skill,
        unitId: item.unitId,
        correct: verdict === 'correct',
        transcript
      }
    ]
    if (index + 1 < items.length) {
      setAnswers(all)
      setIndex(index + 1)
      return
    }
    const r = applyExamResult(progress, course, exam, all, new Date().toISOString(), mode)
    // The exam time counts toward the study goal.
    const session = {
      at: new Date(startedAt).toISOString(),
      mode,
      minutes: Math.round((Date.now() - startedAt) / 60000),
      blocksDone: [],
      errors: all.filter((a) => !a.correct).length
    }
    onDone(recordSession(r.progress, session), r.record)
  }

  return (
    <main className="screen session">
      <header className="session-bar">
        <div>
          <strong>
            Prova do {exam.level} · Parte {partIndex + 1} de {exam.parts.length}:{' '}
            {SKILL_LABELS[part.skill]}
          </strong>
          <div className="muted small">
            Exercício {index + 1} de {items.length} · {mode === 'solo' ? 'solo' : 'guiada'}
          </div>
          <div className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(index / items.length) * 100}%` }} />
          </div>
        </div>
        {/* Informational only: the exam never ends by itself. */}
        <div className={`timer${remaining < 0 ? ' timer-over' : ''}`} role="timer">
          {remaining >= 0
            ? `Faltam ${formatClock(remaining)}`
            : `Tempo previsto passou (${formatClock(remaining)}) · pode continuar`}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (window.confirm('Sair da prova? Esta tentativa não é salva.')) onQuit()
          }}
        >
          Sair da prova
        </button>
      </header>
      <ExerciseView key={index} exercise={item.exercise} mode={mode} exam onFinal={handleFinal} />
    </main>
  )
}
