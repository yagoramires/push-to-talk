import { useEffect, useRef, useState } from 'react'
import type { PronunciationResult } from '../../../shared/api'
import { encodeWav } from '../../../shared/wav'
import { SAMPLE_RATE, startRecording, type Recorder } from '../audio/recorder'

const MAX_SECONDS = 30
const MIC_ERROR =
  'Não consegui acessar o microfone. Verifique em Ajustes do Sistema → Privacidade e Segurança → Microfone.'

type Props = {
  /** Text the learner should say; enables pronunciation scoring when the AI has it. */
  expected?: string
  onTranscript(text: string, pronunciation?: PronunciationResult): void
  /** Mic or transcription unavailable; the message is in Portuguese, ready to show. */
  onFailure(message: string): void
}

export default function RecordButton({
  expected,
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
      const r = await window.api.transcribe(encodeWav(await rec.stop(), SAMPLE_RATE), expected)
      setStatus('idle')
      if (r.ok) onTranscript(r.text, r.pronunciation)
      else onFailure(`A transcrição não está disponível (${r.message}).`)
    } catch (e) {
      setStatus('idle')
      onFailure(`A transcrição não está disponível (${(e as Error).message}).`)
    }
  }

  if (status === 'transcribing')
    return (
      <button type="button" className="btn btn-record" disabled>
        Transcrevendo…
      </button>
    )
  return status === 'recording' ? (
    <button type="button" className="btn btn-record recording" onClick={() => void stop()}>
      ⏹ Parar e conferir
    </button>
  ) : (
    <button type="button" className="btn btn-record" onClick={() => void start()}>
      🎙 Gravar resposta
    </button>
  )
}
