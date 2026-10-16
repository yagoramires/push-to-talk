import { useEffect, useRef, useState } from 'react'
import type { AiProgress, AiStatus, Tier } from '../../../shared/api'
import { downloadBytes } from '../../../shared/models'
import { describeHardware, formatSize, TIER_LABELS, TIERS } from '../flow'

type Props = {
  status: AiStatus
  /** Called with the new status after a successful setup, or with nothing on "Agora não"/"Voltar". */
  onClose(status?: AiStatus): void
}

/** First-run AI setup, and tier change from "Configurações da IA" when a tier already exists. */
export default function SetupScreen({ status, onClose }: Props): React.JSX.Element {
  const changing = status.tier !== null
  const recommended = status.recommended ?? 'light'
  const [tier, setTier] = useState<Tier>(status.tier ?? recommended)
  const [picking, setPicking] = useState(changing)
  const [progress, setProgress] = useState<AiProgress | null>(null)

  const lastPhase = useRef<AiProgress['phase'] | null>(null)

  useEffect(
    () =>
      window.api.onAiProgress((p) => {
        lastPhase.current = p.phase
        setProgress(p)
      }),
    []
  )

  async function run(): Promise<void> {
    lastPhase.current = null
    setProgress({ phase: 'stt', percent: 0, message: 'Preparando…' })
    try {
      // No explicit pick: main chooses after the benchmark, so a fast PC can still get "médio".
      const s = await window.api.setupAi(picking ? tier : undefined)
      // Failures arrive as an 'error' progress event (sent before setupAi resolves).
      if (lastPhase.current === 'done') onClose(s)
    } catch (e) {
      setProgress({
        phase: 'error',
        percent: 0,
        message: `Falha ao preparar a IA: ${(e as Error).message}`
      })
    }
  }

  const running = progress && progress.phase !== 'error'
  const aboveRecommended = TIERS.indexOf(tier) > TIERS.indexOf(recommended)

  return (
    <main className="screen">
      <h1>{changing ? 'Configurações da IA' : 'Preparar a IA'}</h1>
      <section className="panel">
        <p>
          A IA corrige sua fala e suas respostas livres no próprio computador, sem internet. Ela
          precisa ser baixada uma vez.
        </p>
        {status.hardware && (
          <>
            <h2>Seu computador</h2>
            <ul>
              {describeHardware(status.hardware).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        )}
        {changing && (
          <p>
            Pacote atual: <strong>{TIER_LABELS[status.tier!]}</strong>
          </p>
        )}
        <p>
          Pacote recomendado: <strong>{TIER_LABELS[recommended]}</strong> (download de{' '}
          {formatSize(downloadBytes(recommended))})
        </p>
      </section>

      {running ? (
        <section className="panel">
          <p aria-live="polite">{progress.message}</p>
          <progress
            className="setup-progress"
            max={100}
            value={progress.percent}
            aria-label={progress.message}
          />
          <p className="muted">{progress.percent}%</p>
        </section>
      ) : (
        <section className="panel">
          {progress?.phase === 'error' && (
            <p className="notice notice-warn" role="alert">
              {progress.message} Você pode tentar de novo ou seguir com a marcação manual.
            </p>
          )}
          {picking && (
            <>
              <h2 id="tier-label">Pacote</h2>
              <div className="segmented" role="radiogroup" aria-labelledby="tier-label">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={tier === t}
                    className={`btn btn-option${tier === t ? ' selected' : ''}`}
                    onClick={() => setTier(t)}
                  >
                    {TIER_LABELS[t]} · {formatSize(downloadBytes(t))}
                  </button>
                ))}
              </div>
              {aboveRecommended && (
                <p className="notice notice-warn" role="alert">
                  Este pacote é maior do que o recomendado para o seu computador. A correção pode
                  ficar lenta ou não funcionar.
                </p>
              )}
            </>
          )}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => void run()}>
              {progress?.phase === 'error' ? 'Tentar de novo' : 'Baixar e preparar'} (
              {formatSize(downloadBytes(tier))})
            </button>
            {!picking && (
              <button type="button" className="btn btn-secondary" onClick={() => setPicking(true)}>
                Escolher outro pacote
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => onClose()}>
              {changing ? 'Voltar' : 'Agora não'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void window.api.openLogs()}
            >
              Abrir pasta de logs
            </button>
          </div>
          {!changing && (
            <p className="muted">
              Sem a IA, você marca sozinho se acertou cada resposta falada. Dá para preparar depois
              em “Configurações da IA”.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
