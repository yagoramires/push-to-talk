import type { Course } from '../../../shared/content'
import type { ProfileProgress, SessionRecord } from '../../../shared/progress'
import { BLOCK_LABELS, describePosition } from '../flow'

type Props = {
  course: Course
  progress: ProfileProgress
  record: SessionRecord
  onHome(): void
}

export default function SummaryScreen({
  course,
  progress,
  record,
  onHome
}: Props): React.JSX.Element {
  const blockName = (id: string): string => {
    for (const u of course.units) {
      const b = u.blocks.find((x) => x.id === id)
      if (b) return `${BLOCK_LABELS[b.kind]} · ${u.title_pt}`
    }
    return id
  }
  const pending = progress.errorLog.filter((e) => !e.resolved).length
  return (
    <main className="screen">
      <h1>Resumo da sessão</h1>
      <section className="panel">
        <h2>Blocos feitos</h2>
        {record.blocksDone.length ? (
          <ul>
            {record.blocksDone.map((id) => (
              <li key={id}>{blockName(id)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nenhum bloco completo nesta sessão.</p>
        )}
        <h2>Erros</h2>
        <p>
          {record.errors} {record.errors === 1 ? 'erro' : 'erros'} nesta sessão · {pending} para
          revisar na próxima
        </p>
        <h2>Próxima sessão</h2>
        <p>{describePosition(course, progress.position) ?? 'Você concluiu o curso!'}</p>
      </section>
      <button type="button" className="btn btn-primary" autoFocus onClick={onHome}>
        Voltar ao início
      </button>
    </main>
  )
}
