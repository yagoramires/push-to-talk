import { useState } from 'react'
import type { Dialogue } from '../../../shared/content'
import { dialogueVerdict } from '../../../shared/dialogue'
import { showAccepted, type FinalVerdict } from '../../../shared/matcher'
import type { Mode } from '../../../shared/progress'
import ListenButton from './ListenButton'
import { SpokenAnswer } from './SpokenExercise'

type Said = { verdict: FinalVerdict; transcript: string }

/** Role-play: partner lines on the left, the learner's turns on the right, one SpokenAnswer per turn. */
export default function DialogueView({
  exercise: ex,
  mode,
  exam,
  onFinal
}: {
  exercise: Dialogue
  mode: Mode
  exam?: boolean
  onFinal(v: FinalVerdict, transcript: string): void
}): React.JSX.Element {
  const [said, setSaid] = useState<Said[]>([])
  const youTotal = ex.turns.filter((t) => t.speaker === 'you').length
  const done = said.length === youTotal
  // Show every turn up to and including the next one the learner has to say.
  const youAt = ex.turns.flatMap((t, i) => (t.speaker === 'you' ? [i] : []))
  const shown = done ? ex.turns : ex.turns.slice(0, youAt[said.length] + 1)
  const hits = said.filter((s) => s.verdict === 'correct').length

  let youIndex = 0
  return (
    <article className="exercise">
      <p className="instruction">{ex.instruction_pt}</p>
      <p className="muted">{ex.scene_pt}</p>
      <div className="dialogue">
        {shown.map((t, i) => {
          if (t.speaker === 'partner')
            return (
              <div key={i} className="turn turn-partner">
                <p className="prompt" lang="en">
                  {t.text}
                </p>
                <ListenButton text={t.text} />
              </div>
            )
          const n = youIndex++
          const answer = said[n]
          return (
            <div key={i} className="turn turn-you">
              <p className="prompt">
                {answer ? (
                  <>
                    <span aria-label={answer.verdict === 'correct' ? 'certo' : 'errado'}>
                      {answer.verdict === 'correct' ? '✓' : '✗'}
                    </span>{' '}
                    <span lang="en">{answer.transcript || showAccepted(t.accepted[0])}</span>
                  </>
                ) : (
                  t.cue_pt
                )}
              </p>
              {!answer && (
                <SpokenAnswer
                  key={n}
                  check={t}
                  mode={mode}
                  exam={exam}
                  onFinal={(verdict, transcript) => setSaid([...said, { verdict, transcript }])}
                />
              )}
            </div>
          )
        })}
      </div>
      {done && (
        <div className="actions">
          {!exam && (
            <p className="result-verdict">
              Você acertou {hits} de {youTotal} falas.
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            autoFocus
            onClick={() =>
              onFinal(
                dialogueVerdict(said.map((s) => s.verdict)),
                said.map((s) => s.transcript).join(' / ')
              )
            }
          >
            Continuar
          </button>
        </div>
      )}
    </article>
  )
}
