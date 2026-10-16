// shortcut: system TTS voice; Plan 5 swaps in the bundled audio files when `audio` exists.
export function speak(text: string): void {
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  // getVoices() can be empty before the voices load; `lang` alone still picks an English voice.
  const voice = synth.getVoices().find((v) => v.lang.replace('_', '-') === 'en-US')
  if (voice) utterance.voice = voice
  synth.speak(utterance)
}
