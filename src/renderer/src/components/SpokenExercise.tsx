import { useState } from 'react'
import type { CommonError, FreeSpeak } from '../../../shared/content'
import {
  checkAnswer,
  normalize,
  type CheckResult,
  type FinalVerdict
} from '../../../shared/matcher'
import type { Mode } from '../../../shared/progress'
import RecordButton from './RecordButton'
import ResultView from './ResultView'

type OnFinal = (v: FinalVerdict, transcript: string) => void

const UNCLEAR = 'Não entendi, tente de novo.'

function ManualMark({
  onFinal,
  correctLabel = 'Marcar como certo',
  errorLabel = 'Marcar como errado'
}: {
  onFinal(v: FinalVerdict): void
  correctLabel?: string
  errorLabel?: string
}): React.JSX.Element {
  return (
    <div className="actions">
      <button type="button" className="btn btn-correct" onClick={() => onFinal('correct')}>
        ✓ {correctLabel}
      </button>
      <button type="button" className="btn btn-error" onClick={() => onFinal('error')}>
        ✗ {errorLabel}
      </button>
    </div>
  )
}

type SpokenState =
  | { kind: 'idle' }
  | { kind: 'unclear' }
  | { kind: 'failed'; message: string }
  | { kind: 'result'; result: CheckResult; transcript: string }

/**
 * The answer part of a spoken exercise: record → transcribe → check → ResultView.
 * Task 8 swaps the RecordButton for teacher verdict buttons in guided mode.
 */
export function SpokenAnswer({
  check,
  mode,
  onFinal
}: {
  check: { accepted: string[]; commonErrors: CommonError[] }
  mode: Mode
  onFinal: OnFinal
}): React.JSX.Element {
  const [state, setState] = useState<SpokenState>({ kind: 'idle' })

  if (state.kind === 'result')
    return (
      <ResultView
        result={state.result}
        transcript={state.transcript}
        mode={mode}
        onFinal={(v) => onFinal(v, state.transcript)}
      />
    )
  if (state.kind === 'failed')
    return (
      <div className="notice notice-warn" role="alert">
        <p>{state.message}</p>
        <p>Você pode marcar sozinho se acertou e seguir com a sessão.</p>
        <ManualMark onFinal={(v) => onFinal(v, '')} />
      </div>
    )
  return (
    <div className="answer">
      <RecordButton
        onTranscript={(text) => {
          const result = checkAnswer(text, check)
          setState(
            result.verdict === 'unclear'
              ? { kind: 'unclear' }
              : { kind: 'result', result, transcript: text }
          )
        }}
        onFailure={(message) => setState({ kind: 'failed', message })}
      />
      <p className="notice" aria-live="polite">
        {state.kind === 'unclear' ? UNCLEAR : ''}
      </p>
    </div>
  )
}

type FreeState =
  | { kind: 'idle' }
  | { kind: 'unclear' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; transcript: string }

// shortcut: self-assessment against the guidelines; Plan 2 brings the text model to judge it.
export function FreeSpeakAnswer({
  exercise,
  onFinal
}: {
  exercise: FreeSpeak
  onFinal: OnFinal
}): React.JSX.Element {
  const [state, setState] = useState<FreeState>({ kind: 'idle' })
  const [checked, setChecked] = useState<boolean[]>(() => exercise.guidelines_pt.map(() => false))

  if (state.kind === 'idle' || state.kind === 'unclear')
    return (
      <div className="answer">
        <RecordButton
          onTranscript={(text) =>
            setState(normalize(text) ? { kind: 'done', transcript: text } : { kind: 'unclear' })
          }
          onFailure={(message) => setState({ kind: 'failed', message })}
        />
        <p className="notice" aria-live="polite">
          {state.kind === 'unclear' ? UNCLEAR : ''}
        </p>
      </div>
    )

  const transcript = state.kind === 'done' ? state.transcript : ''
  return (
    <section className="result" aria-live="polite">
      {state.kind === 'failed' ? (
        <p className="notice notice-warn" role="alert">
          {state.message} Fale em voz alta e avalie você mesmo.
        </p>
      ) : (
        <p>
          <span className="muted">Você disse: </span>
          <span lang="en">{transcript}</span>
        </p>
      )}
      <p className="result-verdict">Confira o que você conseguiu fazer:</p>
      <ul className="checklist">
        {exercise.guidelines_pt.map((g, i) => (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => setChecked((c) => c.map((x, j) => (j === i ? !x : x)))}
              />{' '}
              {g}
            </label>
          </li>
        ))}
      </ul>
      <ManualMark
        correctLabel="Consegui"
        errorLabel="Preciso praticar mais"
        onFinal={(v) => onFinal(v, transcript)}
      />
    </section>
  )
}
