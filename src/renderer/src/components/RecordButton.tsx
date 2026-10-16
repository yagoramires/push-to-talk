import { useEffect, useRef, useState } from 'react'
import { encodeWav } from '../../../shared/wav'
import { SAMPLE_RATE, startRecording, type Recorder } from '../audio/recorder'

const MIC_ERROR =
  'Não consegui acessar o microfone. Verifique em Ajustes do Sistema → Privacidade e Segurança → Microfone.'

type Props = {
  onTranscript(text: string): void
  /** Mic or transcription unavailable; the message is in Portuguese, ready to show. */
  onFailure(message: string): void
}

export default function RecordButton({ onTranscript, onFailure }: Props): React.JSX.Element {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const recorder = useRef<Recorder | null>(null)

  // Release the mic if the exercise goes away mid-recording.
  useEffect(() => () => void recorder.current?.stop(), [])

  async function start(): Promise<void> {
    try {
      if (!(await window.api.ensureMic())) return onFailure(MIC_ERROR)
      recorder.current = await startRecording()
      setStatus('recording')
    } catch {
      onFailure(MIC_ERROR)
    }
  }

  async function stop(): Promise<void> {
    const rec = recorder.current
    if (!rec) return
    recorder.current = null
    setStatus('transcribing')
    try {
      const r = await window.api.transcribe(encodeWav(await rec.stop(), SAMPLE_RATE))
      setStatus('idle')
      if (r.ok) onTranscript(r.text)
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
  // shortcut: the recorder auto-stops at 30 s but the button stays in "Parar" until clicked.
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
