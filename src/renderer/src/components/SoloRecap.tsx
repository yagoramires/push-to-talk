import type { soloSinceLastGuided } from '../../../shared/progress'

type Recap = ReturnType<typeof soloSinceLastGuided>

/** Shown before the first step of a guided lesson (the caller skips it when there is nothing to report). */
export default function SoloRecap({
  recap,
  onStart
}: {
  recap: Recap
  onStart(): void
}): React.JSX.Element {
  return (
    <section className="panel" aria-labelledby="recap-title">
      <h2 id="recap-title">O que foi feito sozinho desde a última aula</h2>
      <ul>
        <li>Sessões solo: {recap.sessions.length}</li>
        <li>Blocos concluídos: {recap.blocksDone.length}</li>
        <li>Erros pendentes: {recap.openErrors.length}</li>
      </ul>
      <button type="button" className="btn btn-primary" autoFocus onClick={onStart}>
        Começar aula
      </button>
    </section>
  )
}
