import { projectedFinish, type Goal, type GoalPlan, type studyStats } from '../../../shared/goal'

type Props = {
  goal: Goal
  plan: GoalPlan
  stats: ReturnType<typeof studyStats>
  now: Date
  onEdit(): void
}

function Bar({ label, done, of }: { label: string; done: number; of: number }): React.JSX.Element {
  return (
    <>
      <p className="goal-line">
        {label}: {done} de {of} min
      </p>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, of ? (done / of) * 100 : 100)}%` }} />
      </div>
    </>
  )
}

export default function TodayGoal({ goal, plan, stats, now, onEdit }: Props): React.JSX.Element {
  const edit = (
    <button type="button" className="btn btn-secondary" onClick={onEdit}>
      Minha meta
    </button>
  )
  if (plan.feasibility === 'alcancada')
    return (
      <section className="panel panel-highlight" aria-labelledby="goal-label">
        <h2 id="goal-label">Meta alcançada!</h2>
        <p>Você já passou do {goal.target}. Que tal uma meta nova?</p>
        {edit}
      </section>
    )
  const week = plan.minutesPerDay * goal.daysPerWeek
  // Fewer than 3 active days make the pace meaningless (1 minute on day one projects year 2486).
  const finish =
    stats.activeDays14 >= 3 ? projectedFinish(plan.hoursLeft, stats.avgPerDay14, now) : null
  return (
    <section className="panel" aria-labelledby="goal-label">
      <h2 id="goal-label">Meta: {goal.target}</h2>
      <Bar label="Hoje" done={stats.todayMinutes} of={plan.minutesPerDay} />
      <Bar label="Semana" done={stats.weekMinutes} of={week} />
      {stats.weekMinutes >= week && <p className="goal-done">Meta da semana cumprida!</p>}
      {plan.minutesPerDay > 60 && stats.todayMinutes < plan.minutesPerDay && (
        <p>Faça duas sessões hoje.</p>
      )}
      <p className="muted">
        Sequência: {stats.streakDays} {stats.streakDays === 1 ? 'dia seguido' : 'dias seguidos'}
      </p>
      <p className="muted">
        {finish
          ? `No seu ritmo, você chega ao ${goal.target} em ${finish.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.`
          : 'Estude alguns dias para ver a previsão.'}
      </p>
      {edit}
    </section>
  )
}
