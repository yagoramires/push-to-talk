import { useState } from 'react'
import type { Block, Exercise } from '../../../shared/content'

function Answers({ ex }: { ex: Exercise }): React.JSX.Element | null {
  const list: string[] =
    ex.kind === 'choice'
      ? [ex.options[ex.answer]]
      : ex.kind === 'match'
        ? ex.pairs.map((p) => `${p.en} = ${p.pt}`)
        : 'accepted' in ex
          ? ex.accepted
          : []
  const errors = 'commonErrors' in ex ? ex.commonErrors : []
  if (!list.length && !errors.length) return null
  return (
    <>
      {list.length > 0 && (
        <>
          <h4>Respostas aceitas</h4>
          <ul lang="en">
            {list.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}
      {errors.length > 0 && (
        <>
          <h4>Erros comuns</h4>
          <ul>
            {errors.map((e) => (
              <li key={e.id}>
                {e.explanation_pt} <span lang="en">({e.correction_en})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/** Teacher's cheat sheet, hidden until asked for. Key it by exercise so it closes again on each new one. */
export default function TeacherPanel({
  block,
  exercise
}: {
  block?: Block
  exercise: Exercise
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <aside className="teacher-panel">
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Esconder cola do professor' : 'Mostrar cola do professor'}
      </button>
      {open && (
        <div className="panel">
          {block && (
            <>
              <h4>Objetivo do bloco</h4>
              <p>{block.teacher.goal_pt}</p>
              {block.teacher.prompts.length > 0 && (
                <>
                  <h4>Perguntas para puxar conversa</h4>
                  <ul>
                    {block.teacher.prompts.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
              {block.teacher.watchFor.length > 0 && (
                <>
                  <h4>Fique de olho</h4>
                  <ul>
                    {block.teacher.watchFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <Answers ex={exercise} />
        </div>
      )}
    </aside>
  )
}
