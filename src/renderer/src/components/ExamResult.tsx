import { PASS_EACH, PASS_TOTAL } from '../../../shared/assessment'
import { SKILLS, type Course } from '../../../shared/content'
import type { ExamRecord } from '../../../shared/progress'
import { SKILL_LABELS } from '../flow'

type Props = {
  course: Course
  record: ExamRecord
  weakUnits: string[]
  onHome(): void
}

const pct = (x: number): string => `${Math.round(x * 100)}%`

export default function ExamResult({
  course,
  record,
  weakUnits,
  onHome
}: Props): React.JSX.Element {
  const title = (id: string): string => course.units.find((u) => u.id === id)?.title_pt ?? id
  return (
    <main className="screen">
      <h1>Prova do {record.level}</h1>
      <section
        className={`result result-${record.passed ? 'correct' : 'error'}`}
        aria-live="polite"
      >
        <p className="result-verdict">
          {record.passed ? 'Aprovado!' : 'Ainda não foi desta vez.'} Nota total: {pct(record.total)}
        </p>
        {record.passed && record.level === 'C1' && <p>Parabéns, você concluiu o curso!</p>}
        <ul>
          {SKILLS.map((s) => (
            <li key={s}>
              {SKILL_LABELS[s]}: {pct(record.scores[s])}
            </li>
          ))}
        </ul>
        <p className="muted">
          Para passar: {pct(PASS_TOTAL)} no total e {pct(PASS_EACH)} em cada parte.
        </p>
        {!record.passed && weakUnits.length > 0 && (
          <>
            <p>Vale reforçar estas unidades (as próximas sessões trazem elas):</p>
            <ul>
              {weakUnits.map((id) => (
                <li key={id}>{title(id)}</li>
              ))}
            </ul>
          </>
        )}
        {!record.passed && <p>Você pode refazer a prova quando quiser, pelo início.</p>}
      </section>
      <button type="button" className="btn btn-primary" autoFocus onClick={onHome}>
        Voltar ao início
      </button>
    </main>
  )
}
