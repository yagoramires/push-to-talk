import { useState } from 'react'
import {
  currentPlacementItems,
  finishPlacementLevel,
  startPlacement
} from '../../../shared/assessment'
import { LEVELS, type Level, type Placement, type Skill } from '../../../shared/content'
import type { FinalVerdict } from '../../../shared/matcher'
import ExerciseView from '../components/ExerciseView'
import { placementStartLevel, SKILL_LABELS, skillSummary } from '../flow'

type Props = {
  placement: Placement
  /** Levels that have units in the course. */
  levels: Level[]
  /** minutes = time spent on the placement; goal = go set a study goal next. */
  onDone(level: Level, minutes: number, goal: boolean): void
  onQuit(): void
}

/** Solo, level by level; errors do not go to the error log and nothing is saved until "Começar". */
export default function PlacementScreen({
  placement,
  levels,
  onDone,
  onQuit
}: Props): React.JSX.Element {
  const [state, setState] = useState(startPlacement)
  const [startedAt] = useState(() => Date.now())
  const [index, setIndex] = useState(0)
  const [levelAnswers, setLevelAnswers] = useState<{ skill: Skill; correct: boolean }[]>([])

  if (state.done && state.result) {
    const result = state.result
    const start = placementStartLevel(result, levels)
    const finish = (goal: boolean): void =>
      onDone(start, Math.round((Date.now() - startedAt) / 60000), goal)
    return (
      <main className="screen">
        <h1>Nivelamento concluído</h1>
        <section className="panel" aria-live="polite">
          <p className="big">Seu nível inicial: {result}</p>
          {start !== result && (
            <p className="notice notice-warn">
              Seu nível é {result}. As unidades desse nível ainda não estão no app; por enquanto
              você começa no nível mais alto disponível ({start}).
            </p>
          )}
          <h2>Acertos por habilidade</h2>
          <ul>
            {skillSummary(state.answers).map((s) => (
              <li key={s.skill}>
                {SKILL_LABELS[s.skill]}: {s.correct} de {s.total}
              </li>
            ))}
          </ul>
        </section>
        <div className="actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={() => finish(false)}>
            Começar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => finish(true)}>
            Definir minha meta
          </button>
        </div>
      </main>
    )
  }

  const items = currentPlacementItems(placement, state)
  const item = items[index]

  function handleFinal(verdict: FinalVerdict): void {
    const all = [...levelAnswers, { skill: item.skill, correct: verdict === 'correct' }]
    if (index + 1 < items.length) {
      setLevelAnswers(all)
      setIndex(index + 1)
      return
    }
    setState(finishPlacementLevel(state, all))
    setLevelAnswers([])
    setIndex(0)
  }

  return (
    <main className="screen session">
      <header className="session-bar">
        <div>
          {/* The level is not shown, so it does not weigh on the answers. */}
          <strong>
            Nivelamento · Parte {state.levelIndex + 1} de até {LEVELS.length}
          </strong>
          <div className="muted small">
            Exercício {index + 1} de {items.length}
          </div>
          <div className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(index / items.length) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (window.confirm('Sair do nivelamento? Nada desta tentativa é salvo.')) onQuit()
          }}
        >
          Sair
        </button>
      </header>
      <ExerciseView
        key={`${state.levelIndex}-${index}`}
        exercise={item.exercise}
        mode="solo"
        exam
        onFinal={handleFinal}
      />
    </main>
  )
}
