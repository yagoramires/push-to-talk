import type { PronunciationResult } from '../../../shared/api'

/** Guidance only: shown under the verdict, never changes it. */
export default function PronunciationView({
  result
}: {
  result: PronunciationResult
}): React.JSX.Element {
  const toPractice = result.words.filter((w) => !w.ok).length
  return (
    <div className="pronunciation">
      <p>
        <span className="muted">Pronúncia: </span>
        <strong>{result.score} de 100</strong>
        {toPractice > 0 && (
          <span className="muted">
            {' '}
            · {toPractice} {toPractice === 1 ? 'palavra para treinar' : 'palavras para treinar'}
          </span>
        )}
      </p>
      {toPractice > 0 && (
        <p className="diff" lang="en">
          {result.words.map((w, i) => (
            <span key={i} className={w.ok ? 'diff-ok' : 'pron-practice'}>
              {w.word}
              {!w.ok && <small lang="pt-BR"> (treinar)</small>}
            </span>
          ))}
        </p>
      )}
      <p className="muted small">
        A nota de pronúncia é só uma orientação: ela não muda o resultado do exercício.
      </p>
    </div>
  )
}
