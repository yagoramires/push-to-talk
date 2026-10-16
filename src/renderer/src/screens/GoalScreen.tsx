import { useState } from 'react'
import { LEVELS, type Level } from '../../../shared/content'
import { GOAL_DAYS, GOAL_MONTHS, planGoal, type Goal } from '../../../shared/goal'

type Props = {
  level: Level
  goal: Goal | null
  onSave(goal: Goal): void
  onCancel(): void
}

const monthsLabel = (m: number): string => (m === 1 ? '1 mês' : `${m} meses`)

function Choice<T extends string | number>(props: {
  id: string
  label: string
  options: readonly T[]
  value: NoInfer<T>
  format(v: NoInfer<T>): string
  onChange(v: NoInfer<T>): void
}): React.JSX.Element {
  return (
    <>
      <h2 id={props.id}>{props.label}</h2>
      <div className="segmented" role="radiogroup" aria-labelledby={props.id}>
        {props.options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={props.value === o}
            className={`btn btn-option${props.value === o ? ' selected' : ''}`}
            onClick={() => props.onChange(o)}
          >
            {props.format(o)}
          </button>
        ))}
      </div>
    </>
  )
}

export default function GoalScreen({ level, goal, onSave, onCancel }: Props): React.JSX.Element {
  // Targets: the current level (finish it) and every level above it.
  const targets = LEVELS.slice(LEVELS.indexOf(level))
  const [target, setTarget] = useState<Level>(
    goal && targets.includes(goal.target) ? goal.target : (targets[1] ?? level)
  )
  const [months, setMonths] = useState<Goal['months']>(goal?.months ?? 6)
  const [daysPerWeek, setDaysPerWeek] = useState<Goal['daysPerWeek']>(goal?.daysPerWeek ?? 6)
  const plan = planGoal({ level, target, months, daysPerWeek, studiedMinutes: 0 })

  return (
    <main className="screen">
      <h1>Minha meta</h1>
      <section className="panel">
        <Choice
          id="goal-target"
          label="Aonde você quer chegar?"
          options={targets}
          value={target}
          format={(l) => (l === level ? `Terminar o ${l}` : l)}
          onChange={setTarget}
        />
        <Choice
          id="goal-months"
          label="Em quanto tempo?"
          options={GOAL_MONTHS}
          value={months}
          format={monthsLabel}
          onChange={setMonths}
        />
        <Choice
          id="goal-days"
          label="Quantos dias por semana você estuda?"
          options={GOAL_DAYS}
          value={daysPerWeek}
          format={(d) => `${d} dias`}
          onChange={setDaysPerWeek}
        />
      </section>
      <section
        className={`panel${plan.feasibility === 'ok' ? ' panel-highlight' : ''}`}
        aria-live="polite"
      >
        <p className="muted">Para chegar lá, estude</p>
        <p className="big">{plan.minutesPerDay} min por dia</p>
        {plan.feasibility === 'ok' && <p>Cabe em até 1 hora por dia.</p>}
        {plan.feasibility === 'puxado' && <p className="notice notice-warn">Dá, mas é puxado.</p>}
        {plan.feasibility === 'irreal' && (
          <div className="notice notice-warn">
            <p>Essa meta pede mais de 2 horas por dia.</p>
            <p>
              {plan.suggestedMonths
                ? `Um prazo que cabe em 1 hora por dia: ${monthsLabel(plan.suggestedMonths)}.`
                : 'Nenhum prazo da lista cabe em 1 hora por dia.'}
            </p>
          </div>
        )}
        <p className="muted small">
          Faltam cerca de {Math.round(plan.hoursLeft)} horas (estimativa do Cambridge para horas de
          estudo guiado).
        </p>
        <p>
          As aulas do app cobrem parte disso. O resto vem da prática extra, da revisão e do inglês
          fora do app: séries, música, conversas.
        </p>
      </section>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            onSave({ target, months, daysPerWeek, createdAt: new Date().toISOString() })
          }
        >
          Salvar meta
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Agora não
        </button>
      </div>
    </main>
  )
}
