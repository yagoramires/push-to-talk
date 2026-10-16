import { useState } from 'react'
import type {
  ChoiceExercise,
  Exercise,
  FillExercise,
  MatchExercise,
  OrderExercise
} from '../../../shared/content'
import {
  checkChoice,
  checkFill,
  checkMatch,
  checkOrder,
  normalize,
  type CheckResult,
  type FinalVerdict
} from '../../../shared/matcher'
import type { Mode } from '../../../shared/progress'
import { shuffled, vocabAsRepeat } from '../flow'
import ListenButton from './ListenButton'
import ResultView from './ResultView'
import { FreeSpeakAnswer, SpokenAnswer } from './SpokenExercise'

type Props = {
  exercise: Exercise
  mode: Mode
  onFinal(v: FinalVerdict, transcript: string): void
}

/** Renders one exercise of any kind. Remount it (key) for each new exercise. */
export default function ExerciseView({ exercise: ex, mode, onFinal }: Props): React.JSX.Element {
  switch (ex.kind) {
    case 'vocab':
      return (
        <article className="exercise">
          <p className="instruction">Ouça e repita a palavra e a frase de exemplo.</p>
          <div className="card">
            <p className="card-word" lang="en">
              {ex.word_en}
            </p>
            <p className="muted">{ex.meaning_pt}</p>
            <p className="prompt" lang="en">
              {ex.example_en}
            </p>
          </div>
          <div className="actions">
            <ListenButton text={`${ex.word_en}. ${ex.example_en}`} />
          </div>
          <SpokenAnswer check={vocabAsRepeat(ex)} mode={mode} onFinal={onFinal} />
        </article>
      )
    case 'free_speak':
      return (
        <article className="exercise">
          <p className="instruction">{ex.instruction_pt}</p>
          <p className="prompt" lang="en">
            {ex.prompt_en}
          </p>
          <div className="actions">
            <ListenButton text={ex.prompt_en} />
          </div>
          <FreeSpeakAnswer exercise={ex} mode={mode} onFinal={onFinal} />
        </article>
      )
    case 'repeat':
    case 'translate':
    case 'listen_answer': {
      const listenText = ex.listen ?? ex.prompt
      return (
        <article className="exercise">
          <p className="instruction">{ex.instruction_pt}</p>
          {ex.prompt && (
            <p className="prompt" lang="en">
              {ex.prompt}
            </p>
          )}
          {listenText && (
            <div className="actions">
              <ListenButton text={listenText} />
            </div>
          )}
          <SpokenAnswer check={ex} mode={mode} onFinal={onFinal} />
        </article>
      )
    }
    default:
      return <CheckedExercise exercise={ex} mode={mode} onFinal={onFinal} />
  }
}

type Answer = { result: CheckResult; transcript: string }
type ViewProps<E> = {
  ex: E
  locked: boolean
  onCheck(result: CheckResult, transcript: string): void
}

function CheckedExercise({
  exercise: ex,
  mode,
  onFinal
}: Props & {
  exercise: ChoiceExercise | FillExercise | OrderExercise | MatchExercise
}): React.JSX.Element {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const view = {
    locked: answer !== null,
    onCheck: (result: CheckResult, transcript: string) => setAnswer({ result, transcript })
  }
  return (
    <article className="exercise">
      <p className="instruction">{ex.instruction_pt}</p>
      {ex.kind === 'choice' && <ChoiceView ex={ex} {...view} />}
      {ex.kind === 'fill' && <FillView ex={ex} {...view} />}
      {ex.kind === 'order' && <OrderView ex={ex} {...view} />}
      {ex.kind === 'match' && <MatchView ex={ex} {...view} />}
      {answer && (
        <ResultView
          result={answer.result}
          transcript={answer.transcript}
          mode={mode}
          onFinal={(v) => onFinal(v, answer.transcript)}
        />
      )}
    </article>
  )
}

function ChoiceView({ ex, locked, onCheck }: ViewProps<ChoiceExercise>): React.JSX.Element {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <>
      {ex.prompt && (
        <p className="prompt" lang="en">
          {ex.prompt}
        </p>
      )}
      {ex.listen && (
        <div className="actions">
          <ListenButton text={ex.listen} />
        </div>
      )}
      <div className="options">
        {ex.options.map((o, i) => (
          <button
            key={i}
            type="button"
            lang="en"
            className={`btn btn-option${picked === i ? ' selected' : ''}`}
            aria-pressed={picked === i}
            disabled={locked}
            onClick={() => {
              setPicked(i)
              onCheck(checkChoice(ex, i), o)
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {locked && ex.explanation_pt && <p className="result-explanation">{ex.explanation_pt}</p>}
    </>
  )
}

function FillView({ ex, locked, onCheck }: ViewProps<FillExercise>): React.JSX.Element {
  const [typed, setTyped] = useState('')
  const [before, after] = ex.sentence.split('___')
  // Punctuation-only input would be "unclear" and has nothing to grade.
  const empty = !normalize(typed)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!empty && !locked) onCheck(checkFill(ex, typed), typed)
      }}
    >
      <p className="prompt" lang="en">
        {before}
        <input
          className="fill-input"
          aria-label="Resposta da lacuna"
          value={typed}
          disabled={locked}
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
        />
        {after}
      </p>
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={empty || locked}>
          Conferir
        </button>
      </div>
    </form>
  )
}

function OrderView({ ex, locked, onCheck }: ViewProps<OrderExercise>): React.JSX.Element {
  const [words] = useState(() => shuffled(ex.accepted[0].split(/\s+/)))
  const [picked, setPicked] = useState<number[]>([])
  const sentence = picked.map((i) => words[i])
  return (
    <>
      <p className="prompt built" lang="en" aria-label="Frase montada">
        {sentence.length ? sentence.join(' ') : <span className="muted">Clique nas palavras…</span>}
      </p>
      <div className="options options-inline">
        {words.map((w, i) =>
          picked.includes(i) ? null : (
            <button
              key={i}
              type="button"
              lang="en"
              className="btn btn-option"
              disabled={locked}
              onClick={() => setPicked([...picked, i])}
            >
              {w}
            </button>
          )
        )}
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={locked || !picked.length}
          onClick={() => setPicked(picked.slice(0, -1))}
        >
          ↶ Desfazer
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || picked.length < words.length}
          onClick={() => onCheck(checkOrder(ex, sentence), sentence.join(' '))}
        >
          Conferir
        </button>
      </div>
    </>
  )
}

function MatchView({ ex, locked, onCheck }: ViewProps<MatchExercise>): React.JSX.Element {
  const [ptColumn] = useState(() => shuffled(ex.pairs.map((p) => p.pt)))
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const used = new Set(Object.values(chosen))

  function pickPt(pt: string): void {
    if (!selected) return
    const next = Object.fromEntries(Object.entries(chosen).filter(([, v]) => v !== pt))
    setChosen({ ...next, [selected]: pt })
    setSelected(null)
  }

  function check(): void {
    const result = checkMatch(ex, chosen)
    const answer = ex.pairs.map((p) => `${p.en} = ${p.pt}`).join(' · ')
    const transcript = ex.pairs.map((p) => `${p.en} = ${chosen[p.en]}`).join(' · ')
    onCheck(result.verdict === 'correct' ? result : { ...result, closest: answer }, transcript)
  }

  return (
    <>
      <p className="muted">Escolha uma expressão em inglês e depois o significado.</p>
      <div className="match">
        <div className="match-col">
          {ex.pairs.map(({ en }) => (
            <button
              key={en}
              type="button"
              lang="en"
              className={`btn btn-option${selected === en ? ' selected' : ''}`}
              aria-pressed={selected === en}
              disabled={locked}
              onClick={() => setSelected(selected === en ? null : en)}
            >
              {en}
              {chosen[en] && <small className="match-link"> → {chosen[en]}</small>}
            </button>
          ))}
        </div>
        <div className="match-col">
          {ptColumn.map((pt) => (
            <button
              key={pt}
              type="button"
              className={`btn btn-option${used.has(pt) ? ' linked' : ''}`}
              disabled={locked || !selected}
              onClick={() => pickPt(pt)}
            >
              {pt}
              {used.has(pt) && <small> (ligado)</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || Object.keys(chosen).length < ex.pairs.length}
          onClick={check}
        >
          Conferir
        </button>
      </div>
    </>
  )
}
