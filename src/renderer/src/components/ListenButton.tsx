import { speak } from '../audio/speak'

export default function ListenButton({ text }: { text: string }): React.JSX.Element {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => speak(text)}>
      🔊 Ouvir
    </button>
  )
}
