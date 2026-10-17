import { useState } from 'react'
import type { Profile } from '../../../shared/api'
import type { Level } from '../../../shared/content'

type Props = {
  profiles: Profile[]
  levels: Level[]
  onSelect(id: string): void
  onCreate(name: string, level: Level): Promise<void>
  /** Creates the profile and starts the placement; absent when the course has no placement. */
  onPlacement?(name: string): Promise<void>
}

export default function ProfilesScreen({
  profiles,
  levels,
  onSelect,
  onCreate,
  onPlacement
}: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<Level | undefined>(levels[0])
  const [manual, setManual] = useState(!onPlacement)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(`Não consegui criar o perfil: ${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <h1>Push to Talk</h1>
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
            if (busy || !name.trim()) return
            if (!manual && onPlacement) void create(() => onPlacement(name))
            else if (level) void create(() => onCreate(name, level))
          }}
        >
          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              // The keyboard would cover the list of existing profiles.
              autoFocus={profiles.length === 0}
            />
          </label>
          {onPlacement && !manual && (
            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
                Fazer o nivelamento (10 a 15 min)
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setManual(true)}>
                Escolher nível manualmente
              </button>
            </div>
          )}
          {manual && (
            <>
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
            </>
          )}
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
