import { useContext } from 'react'
import { AudioIndexContext, speak } from '../audio/speak'

export default function ListenButton({ text }: { text: string }): React.JSX.Element {
  const audio = useContext(AudioIndexContext)
  function listen(): void {
    const file = Object.hasOwn(audio, text) ? audio[text] : undefined
    if (!file) return speak(text)
    window.speechSynthesis.cancel()
    new Audio(`course-audio://audio/${file}`).play().catch(() => speak(text))
  }
  return (
    <button type="button" className="btn btn-secondary" onClick={listen}>
      🔊 Ouvir
    </button>
  )
}
