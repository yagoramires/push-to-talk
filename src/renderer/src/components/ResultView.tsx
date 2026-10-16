import type { Mode } from '../../../shared/progress'
import { toFinalVerdict, type CheckResult, type FinalVerdict } from '../../../shared/matcher'

const LABELS = {
  correct: 'Correto!',
  almost: 'Quase! Vale como certo.',
  error: 'Ainda não.',
  unclear: 'Não entendi, tente de novo.'
} as const

const DIFF_LABELS = { ok: '', missing: 'faltou', extra: 'a mais' } as const

type Props = {
  result: CheckResult
  transcript: string
  mode: Mode
  onFinal(v: FinalVerdict): void
}

export default function ResultView({
  result,
  transcript,
  mode,
  onFinal
}: Props): React.JSX.Element {
  const final = toFinalVerdict(result)
  const err = result.matchedError
  return (
    <section className={`result result-${result.verdict}`} aria-live="polite">
      <p className="result-verdict">{LABELS[result.verdict]}</p>
      {transcript && (
        <p>
          <span className="muted">Você disse: </span>
          <span lang="en">{transcript}</span>
        </p>
      )}
      {err && <p className="result-explanation">{err.explanation_pt}</p>}
      {err && (
        <p>
          <span className="muted">Forma correta: </span>
          <strong lang="en">{err.correction_en}</strong>
        </p>
      )}
      {!err && result.closest && result.verdict !== 'correct' && (
        <p>
          <span className="muted">Resposta esperada: </span>
          <strong lang="en">{result.closest}</strong>
        </p>
      )}
      {result.diff && result.verdict !== 'correct' && (
        <p className="diff" lang="en">
          {result.diff.map((d, i) => (
            <span key={i} className={`diff-${d.status}`}>
              {d.word}
              {DIFF_LABELS[d.status] && <small> ({DIFF_LABELS[d.status]})</small>}
            </span>
          ))}
        </p>
      )}
      {mode === 'guided' ? (
        <div className="actions">
          <button
            type="button"
            className="btn btn-correct"
            autoFocus={final === 'correct'}
            onClick={() => onFinal('correct')}
          >
            ✓ Professor: certo
          </button>
          <button
            type="button"
            className="btn btn-error"
            autoFocus={final === 'error'}
            onClick={() => onFinal('error')}
          >
            ✗ Professor: errado
          </button>
        </div>
      ) : (
        <div className="actions">
          {final && (
            <button
              type="button"
              className="btn btn-primary"
              autoFocus
              onClick={() => onFinal(final)}
            >
              Continuar
            </button>
          )}
          {final === 'error' && (
            <button type="button" className="btn btn-secondary" onClick={() => onFinal('correct')}>
              Acho que acertei
            </button>
          )}
        </div>
      )}
    </section>
  )
}
