import { useEffect, useRef, useState } from 'react'
import type { PronunciationResult } from '../../../shared/api'
import { encodeWav } from '../../../shared/wav'
import { SAMPLE_RATE, startRecording, type Recorder } from '../audio/recorder'

const MAX_SECONDS = 30
const MIC_ERROR =
  'Não consegui acessar o microfone. Verifique em Ajustes do Sistema → Privacidade e Segurança → Microfone.'

const MIC_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="40"
    height="40"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
  </svg>
)
const STOP_ICON = (
  <svg viewBox="0 0 24 24" width="34" height="34">
    <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" />
  </svg>
)

type Props = {
  /** Text the learner should say; enables pronunciation scoring when the AI has it. */
  expected?: string
  /** Prompt-only recognition hint, used when there is no expected sentence. */
  hint?: string
  /** wav: the recorded answer, for the opt-in voice samples. */
  onTranscript(text: string, pronunciation: PronunciationResult | undefined, wav: Uint8Array): void
  /** Mic or transcription unavailable; the message is in Portuguese, ready to show. */
  onFailure(message: string): void
}

export default function RecordButton({
  expected,
  hint,
  onTranscript,
  onFailure
}: Props): React.JSX.Element {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const recorder = useRef<Recorder | null>(null)
  const autoStop = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Release the mic if the exercise goes away mid-recording.
  useEffect(
    () => () => {
      clearTimeout(autoStop.current)
      void recorder.current?.stop()
    },
    []
  )

  async function start(): Promise<void> {
    try {
      if (!(await window.api.ensureMic())) return onFailure(MIC_ERROR)
      recorder.current = await startRecording(MAX_SECONDS)
      setStatus('recording')
      // At the limit the recorder stops itself; go on to transcription as if "Parar" was clicked.
      autoStop.current = setTimeout(() => void stop(), MAX_SECONDS * 1000)
    } catch {
      onFailure(MIC_ERROR)
    }
  }

  async function stop(): Promise<void> {
    clearTimeout(autoStop.current)
    const rec = recorder.current
    if (!rec) return
    recorder.current = null
    setStatus('transcribing')
    try {
      const wav = encodeWav(await rec.stop(), SAMPLE_RATE)
      const r = await window.api.transcribe(wav, expected, hint)
      setStatus('idle')
      if (r.ok) onTranscript(r.text, r.pronunciation, wav)
      else onFailure(`A transcrição não está disponível (${r.message.replace(/\.$/, '')}).`)
    } catch (e) {
      setStatus('idle')
      onFailure(`A transcrição não está disponível (${(e as Error).message.replace(/\.$/, '')}).`)
    }
  }

  if (status === 'transcribing')
    return (
      <button type="button" className="btn btn-record" disabled>
        <span className="mic" aria-hidden="true">
          {MIC_ICON}
        </span>
        Transcrevendo…
      </button>
    )
  return status === 'recording' ? (
    <button type="button" className="btn btn-record recording" onClick={() => void stop()}>
      <span className="mic" aria-hidden="true">
        {STOP_ICON}
      </span>
      Parar e conferir
    </button>
  ) : (
    <button type="button" className="btn btn-record" onClick={() => void start()}>
      <span className="mic" aria-hidden="true">
        {MIC_ICON}
      </span>
      Gravar resposta
    </button>
  )
}
