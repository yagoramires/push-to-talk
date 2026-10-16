import { useContext } from 'react'
import { AudioIndexContext, speak } from '../audio/speak'

// One player for the whole app: a second click restarts instead of playing two copies at once.
const player = new Audio()

export default function ListenButton({ text }: { text: string }): React.JSX.Element {
  const audio = useContext(AudioIndexContext)
  function listen(): void {
    const file = Object.hasOwn(audio, text) ? audio[text] : undefined
    if (!file) return speak(text)
    window.speechSynthesis.cancel()
    player.src = `course-audio://audio/${file}`
    player.play().catch(() => speak(text))
  }
  return (
    <button type="button" className="btn btn-secondary" onClick={listen}>
      🔊 Ouvir
    </button>
  )
}
