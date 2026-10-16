import type { PronunciationResult } from '../../../shared/api'
import type { Mode } from '../../../shared/progress'
import { toFinalVerdict, type CheckResult, type FinalVerdict } from '../../../shared/matcher'
import PronunciationView from './PronunciationView'
import Icon from './Icon'

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
  pronunciation?: PronunciationResult
  /** Assessment: only the verdict and moving on; the detailed correction comes at the end. */
  exam?: boolean
  onFinal(v: FinalVerdict): void
  /** Spoken answers: record again instead of taking the error. */
  onRetry?(): void
}

export default function ResultView({
  result,
  transcript,
  mode,
  pronunciation,
  exam,
  onFinal,
  onRetry
}: Props): React.JSX.Element {
  const final = toFinalVerdict(result)
  const err = exam ? undefined : result.matchedError
  const details = !exam
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
      {details && !err && result.closest && result.verdict !== 'correct' && (
        <p>
          <span className="muted">Resposta esperada: </span>
          <strong lang="en">{result.closest}</strong>
        </p>
      )}
      {details && result.diff && result.verdict !== 'correct' && (
        <p className="diff" lang="en">
          {result.diff.map((d, i) => (
            <span key={i} className={`diff-${d.status}`}>
              {d.word}
              {DIFF_LABELS[d.status] && <small> ({DIFF_LABELS[d.status]})</small>}
            </span>
          ))}
        </p>
      )}
      {details && pronunciation && <PronunciationView result={pronunciation} />}
      {mode === 'guided' ? (
        <div className="actions">
          <button
            type="button"
            className="btn btn-correct"
            autoFocus={final === 'correct'}
            onClick={() => onFinal('correct')}
          >
            <Icon name="check" /> Professor: certo
          </button>
          <button
            type="button"
            className="btn btn-error"
            autoFocus={final === 'error'}
            onClick={() => onFinal('error')}
          >
            <Icon name="x" /> Professor: errado
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
          {final === 'error' && onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Gravar de novo
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
