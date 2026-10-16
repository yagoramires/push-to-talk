import { useState } from 'react'
import type { Profile } from '../../../shared/api'
import type { Level } from '../../../shared/content'

type Props = {
  profiles: Profile[]
  levels: Level[]
  onSelect(id: string): void
  onCreate(name: string, level: Level): Promise<void>
}

export default function ProfilesScreen({
  profiles,
  levels,
  onSelect,
  onCreate
}: Props): React.JSX.Element {
  const [name, setName] = useState('')
  // shortcut: manual level choice until Plan 4 brings the placement test.
  const [level, setLevel] = useState<Level | undefined>(levels[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(): Promise<void> {
    if (!level) return
    setBusy(true)
    setError(null)
    try {
      await onCreate(name, level)
    } catch (e) {
      setError(`Não consegui criar o perfil: ${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>Inglês</h1>
      {profiles.length > 0 && (
        <section className="panel">
          <h2>Quem vai praticar?</h2>
          <div className="options">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn-option"
                onClick={() => onSelect(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="panel">
        <h2>Novo perfil</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Nível inicial
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !name.trim() || !level}
          >
            Criar perfil
          </button>
        </form>
        {error && (
          <p className="notice notice-warn" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
