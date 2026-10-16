import { useRef, useState } from 'react'
import type { FreeSpeakEval, PronunciationResult, Sample } from '../../../shared/api'
import type { CommonError, FreeSpeak } from '../../../shared/content'
import {
  checkAnswer,
  normalize,
  recognitionHint,
  showAccepted,
  type CheckResult,
  type FinalVerdict
} from '../../../shared/matcher'
import type { Mode } from '../../../shared/progress'
import RecordButton from './RecordButton'
import ResultView from './ResultView'

type OnFinal = (v: FinalVerdict, transcript: string) => void

const UNCLEAR = 'Não entendi, tente de novo.'

const TEACHER_MARKS = { correctLabel: 'Professor: certo', errorLabel: 'Professor: errado' }

/** Fire-and-forget: main keeps it only when the learner opted in; never blocks the exercise. */
function saveSample(sample: Sample): void {
  window.api.saveSample(sample).catch((e) => console.warn('saveSample failed', e))
}

/** Without a transcript (guided, mic failed) the learner or teacher still needs to see the answer. */
function Expected({ accepted }: { accepted: string[] }): React.JSX.Element {
  return (
    <p>
      <span className="muted">Resposta esperada: </span>
      <strong lang="en">{showAccepted(accepted[0])}</strong>
    </p>
  )
}

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
  | { kind: 'result'; result: CheckResult; transcript: string; pronunciation?: PronunciationResult }

/**
 * The answer part of a spoken exercise: record → transcribe → check → ResultView.
 * Guided mode has no mic or AI: the teacher's verdict is the final answer.
 */
export function SpokenAnswer({
  exerciseId,
  check,
  expected,
  mode,
  exam,
  onFinal
}: {
  /** Names the saved voice sample (opt-in). */
  exerciseId: string
  check: { accepted: string[]; commonErrors: CommonError[] }
  /** Sentence to score pronunciation against (repeat prompt, vocab example). */
  expected?: string
  mode: Mode
  exam?: boolean
  onFinal: OnFinal
}): React.JSX.Element {
  const [state, setState] = useState<SpokenState>({ kind: 'idle' })
  const wav = useRef<Uint8Array | null>(null)
  // Without an expected sentence, the first accepted answer still steers recognition (prompt only).
  const hint = expected ? undefined : recognitionHint(check.accepted[0])

  if (mode === 'guided')
    return (
      <>
        {!exam && <Expected accepted={check.accepted} />}
        <ManualMark {...TEACHER_MARKS} onFinal={(v) => onFinal(v, '')} />
      </>
    )
  if (state.kind === 'result')
    return (
      <ResultView
        result={state.result}
        transcript={state.transcript}
        mode={mode}
        pronunciation={state.pronunciation}
        exam={exam}
        onRetry={exam ? undefined : () => setState({ kind: 'idle' })}
        onFinal={(verdict) => {
          const { transcript } = state
          if (wav.current)
            saveSample({ exerciseId, mode, wav: wav.current, expected, hint, transcript, verdict })
          onFinal(verdict, transcript)
        }}
      />
    )
  if (state.kind === 'failed')
    return (
      <div className="notice notice-warn" role="alert">
        <p>{state.message}</p>
        <p>Você pode marcar sozinho se acertou e seguir com a sessão.</p>
        {!exam && <Expected accepted={check.accepted} />}
        <ManualMark onFinal={(v) => onFinal(v, '')} />
      </div>
    )
  return (
    <div className="answer">
      <RecordButton
        expected={expected}
        hint={hint}
        onTranscript={(text, pronunciation, audio) => {
          wav.current = audio
          const result = checkAnswer(text, check)
          setState(
            result.verdict === 'unclear'
              ? { kind: 'unclear' }
              : { kind: 'result', result, transcript: text, pronunciation }
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
  | { kind: 'evaluating'; transcript: string }
  | { kind: 'evaluated'; transcript: string; ev: Extract<FreeSpeakEval, { ok: true }> }
  /** Self-assessment checklist; message says why the AI could not judge it. */
  | { kind: 'done'; transcript: string; message?: string }

/** Solo: the local text model judges the answer; without it, self-assessment against the guidelines. */
export function FreeSpeakAnswer({
  exercise,
  mode,
  exam,
  onFinal
}: {
  exercise: FreeSpeak
  mode: Mode
  exam?: boolean
  onFinal: OnFinal
}): React.JSX.Element {
  const [state, setState] = useState<FreeState>({ kind: 'idle' })
  const [checked, setChecked] = useState<boolean[]>(() => exercise.guidelines_pt.map(() => false))
  const wav = useRef<Uint8Array | null>(null)
  const final: OnFinal = (verdict, transcript) => {
    if (wav.current && transcript)
      saveSample({ exerciseId: exercise.id, mode, wav: wav.current, transcript, verdict })
    onFinal(verdict, transcript)
  }

  async function evaluate(transcript: string): Promise<void> {
    setState({ kind: 'evaluating', transcript })
    const { prompt_en, guidelines_pt } = exercise
    const ev: FreeSpeakEval = await window.api
      .evaluateFreeSpeak({ prompt_en, guidelines_pt, transcript })
      .catch((e: Error) => ({ ok: false, reason: 'failed', message: e.message }))
    setState(
      ev.ok
        ? { kind: 'evaluated', transcript, ev }
        : { kind: 'done', transcript, message: ev.message }
    )
  }

  if (mode === 'guided')
    return (
      <section className="result">
        <p className="result-verdict">Para o professor avaliar:</p>
        <ul>
          {exercise.guidelines_pt.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
        <ManualMark {...TEACHER_MARKS} onFinal={(v) => onFinal(v, '')} />
      </section>
    )
  if (state.kind === 'idle' || state.kind === 'unclear')
    return (
      <div className="answer">
        <RecordButton
          onTranscript={(text, _pronunciation, audio) => {
            wav.current = audio
            if (normalize(text)) void evaluate(text)
            else setState({ kind: 'unclear' })
          }}
          onFailure={(message) => setState({ kind: 'failed', message })}
        />
        <p className="notice" aria-live="polite">
          {state.kind === 'unclear' ? UNCLEAR : ''}
        </p>
      </div>
    )

  if (state.kind === 'evaluating')
    return (
      <p className="notice" aria-live="polite">
        Analisando sua resposta…
      </p>
    )

  if (state.kind === 'evaluated') {
    const { transcript, ev } = state
    return (
      <section className={`result result-${ev.correct ? 'correct' : 'error'}`} aria-live="polite">
        <p className="result-verdict">{ev.correct ? 'Correto!' : 'Ainda não.'}</p>
        <p>
          <span className="muted">Você disse: </span>
          <span lang="en">{transcript}</span>
        </p>
        {!exam && (
          <>
            <p className="result-explanation">{ev.feedback_pt}</p>
            <p>
              <span className="muted">Forma corrigida: </span>
              <strong lang="en">{ev.corrected_en}</strong>
            </p>
          </>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            autoFocus
            onClick={() => final(ev.correct ? 'correct' : 'error', transcript)}
          >
            Continuar
          </button>
          {!ev.correct && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => final('correct', transcript)}
            >
              Acho que acertei
            </button>
          )}
        </div>
      </section>
    )
  }

  const transcript = state.kind === 'done' ? state.transcript : ''
  const warning =
    state.kind === 'failed'
      ? `${state.message} Fale em voz alta e avalie você mesmo.`
      : state.message && `${state.message} Avalie você mesmo.`
  return (
    <section className="result" aria-live="polite">
      {warning && (
        <p className="notice notice-warn" role="alert">
          {warning}
        </p>
      )}
      {transcript && (
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
        onFinal={(v) => final(v, transcript)}
      />
    </section>
  )
}
