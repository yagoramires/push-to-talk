import { useEffect, useState } from 'react'
import type { Profile } from '../../shared/api'
import { availableLevels, type Course, type Level } from '../../shared/content'
import {
  newProgress,
  recordSession,
  type Mode,
  type ProfileProgress,
  type SessionRecord
} from '../../shared/progress'
import type { Duration } from '../../shared/session'
import HomeScreen from './screens/HomeScreen'
import ProfilesScreen from './screens/ProfilesScreen'
import SessionScreen from './screens/SessionScreen'
import SummaryScreen from './screens/SummaryScreen'

type Screen =
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'session'; mode: Mode; minutes: Duration }
  | { name: 'summary'; record: SessionRecord }

export default function App(): React.JSX.Element {
  const [course, setCourse] = useState<Course | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [progress, setProgress] = useState<Record<string, ProfileProgress>>({})
  const [recoveredFrom, setRecoveredFrom] = useState<string>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' })

  useEffect(() => {
    Promise.all([window.api.loadCourse(), window.api.loadState()]).then(
      ([c, { state, recoveredFrom }]) => {
        setCourse(c)
        setProfiles(state.profiles)
        setProgress(state.progress)
        setRecoveredFrom(recoveredFrom)
      },
      (e: Error) => setLoadError(e.message)
    )
  }, [])

  /** Updates memory and disk together; a failed save is shown, and the next save retries everything. */
  async function saveProgress(p: ProfileProgress): Promise<void> {
    setProgress((all) => ({ ...all, [p.profileId]: p }))
    try {
      await window.api.saveProgress(p)
      setSaveError(null)
    } catch (e) {
      setSaveError((e as Error).message)
    }
  }

  if (loadError)
    return (
      <main className="screen">
        <p className="notice notice-warn" role="alert">
          Não consegui abrir o app: {loadError}
        </p>
      </main>
    )
  if (!course)
    return (
      <main className="screen">
        <p className="muted">Carregando…</p>
      </main>
    )

  const levels = availableLevels(course)
  const profile = profiles.find((p) => p.id === profileId)
  const current = profileId ? progress[profileId] : undefined

  async function createProfile(name: string, level: Level): Promise<void> {
    const created = await window.api.createProfile(name)
    setProfiles((ps) => [...ps, created])
    await saveProgress(newProgress(created.id, level, course!))
    setProfileId(created.id)
    setScreen({ name: 'home' })
  }

  function selectProfile(id: string): void {
    // A profile can exist without progress if the app closed right after creating it.
    if (!progress[id]) void saveProgress(newProgress(id, levels[0], course!))
    setProfileId(id)
    setScreen({ name: 'home' })
  }

  function endSession(record: SessionRecord): void {
    void saveProgress(recordSession(current!, record))
    setScreen({ name: 'summary', record })
  }

  let body: React.JSX.Element
  if (!profile || !current || screen.name === 'profiles')
    body = (
      <ProfilesScreen
        profiles={profiles}
        levels={levels}
        onSelect={selectProfile}
        onCreate={createProfile}
      />
    )
  else if (screen.name === 'session')
    body = (
      <SessionScreen
        mode={screen.mode}
        course={course}
        progress={current}
        minutes={screen.minutes}
        onProgress={(p) => void saveProgress(p)}
        onEnd={endSession}
      />
    )
  else if (screen.name === 'summary')
    body = (
      <SummaryScreen
        course={course}
        progress={current}
        record={screen.record}
        onHome={() => setScreen({ name: 'home' })}
      />
    )
  else
    body = (
      <HomeScreen
        profile={profile}
        course={course}
        progress={current}
        onStart={(mode, minutes) => setScreen({ name: 'session', mode, minutes })}
        onSwitchProfile={() => setScreen({ name: 'profiles' })}
      />
    )

  return (
    <>
      {recoveredFrom && screen.name !== 'session' && (
        <div className="notice notice-warn banner" role="alert">
          O arquivo de progresso estava corrompido e não pôde ser lido. Guardei uma cópia dele em{' '}
          <code>{recoveredFrom}</code> e comecei com um progresso novo.
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRecoveredFrom(undefined)}
          >
            Entendi
          </button>
        </div>
      )}
      {saveError && (
        <div className="notice notice-warn banner" role="alert">
          Não consegui salvar o progresso ({saveError}). Vou tentar de novo na próxima resposta.
        </div>
      )}
      {body}
    </>
  )
}
