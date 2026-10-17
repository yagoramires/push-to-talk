import { useEffect, useState } from 'react'
import type { AiStatus, Profile } from '../../shared/api'
import { availableLevels, type Course, type Level } from '../../shared/content'
import {
  migrateProgress,
  newProgress,
  recordSession,
  type ExamRecord,
  type Mode,
  type ProfileProgress,
  type SessionRecord
} from '../../shared/progress'
import { buildPracticeSession } from '../../shared/practice'
import type { Duration, SessionPlan } from '../../shared/session'
import { AudioIndexContext } from './audio/speak'
import ExamResult from './components/ExamResult'
import ExamScreen from './screens/ExamScreen'
import GoalScreen from './screens/GoalScreen'
import HomeScreen from './screens/HomeScreen'
import PlacementScreen from './screens/PlacementScreen'
import ProfilesScreen from './screens/ProfilesScreen'
import SessionScreen from './screens/SessionScreen'
import SetupScreen from './screens/SetupScreen'
import SummaryScreen from './screens/SummaryScreen'

type Screen =
  | { name: 'setup' }
  | { name: 'profiles' }
  | { name: 'home' }
  | { name: 'session'; mode: Mode; minutes: Duration; plan?: SessionPlan }
  | { name: 'summary'; record: SessionRecord }
  | { name: 'placement' }
  | { name: 'exam'; mode: Mode; level: Level }
  | { name: 'examResult'; record: ExamRecord }
  | { name: 'goal' }

export default function App(): React.JSX.Element {
  const [course, setCourse] = useState<Course | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [progress, setProgress] = useState<Record<string, ProfileProgress>>({})
  const [recoveredFrom, setRecoveredFrom] = useState<string>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'profiles' })
  const [ai, setAi] = useState<AiStatus | null>(null)

  // A new screen starts at the top, not where the last one was scrolled.
  useEffect(() => window.scrollTo(0, 0), [screen])

  useEffect(() => {
    Promise.all([
      window.api.loadCourse(),
      window.api.loadState(),
      // No AI status is not fatal: the app works with manual marking.
      window.api.aiStatus().catch(() => null)
    ]).then(
      ([c, { state, recoveredFrom }, aiStatus]) => {
        setAi(aiStatus)
        if (aiStatus && !aiStatus.tier) setScreen({ name: 'setup' })
        setCourse(c)
        setProfiles(state.profiles)
        // Progresso salvo antes das provas não tem level/exams; completa ao carregar.
        setProgress(
          Object.fromEntries(
            Object.entries(state.progress).map(([id, p]) => [id, migrateProgress(p, c)])
          )
        )
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

  /** The profile is created now, its progress only when the placement ends ("Começar"). */
  async function createForPlacement(name: string): Promise<void> {
    const created = await window.api.createProfile(name)
    setProfiles((ps) => [...ps, created])
    setProfileId(created.id)
    setScreen({ name: 'placement' })
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
  if (screen.name === 'setup' && ai)
    body = (
      <SetupScreen
        status={ai}
        onClose={(s) => {
          if (s) setAi(s)
          setScreen({ name: 'home' }) // falls back to the profiles screen when none is selected
        }}
      />
    )
  else if (screen.name === 'placement' && profile && course.placement)
    body = (
      <PlacementScreen
        placement={course.placement}
        levels={levels}
        onDone={(level, minutes, goal) => {
          // The placement time counts toward the study goal.
          const session: SessionRecord = {
            at: new Date(Date.now() - minutes * 60000).toISOString(),
            mode: 'solo',
            minutes,
            blocksDone: [],
            errors: 0
          }
          void saveProgress(recordSession(newProgress(profile.id, level, course), session))
          setScreen(goal ? { name: 'goal' } : { name: 'home' })
        }}
        onQuit={() => setScreen({ name: 'profiles' })}
      />
    )
  else if (!profile || !current || screen.name === 'profiles')
    body = (
      <ProfilesScreen
        profiles={profiles}
        levels={levels}
        onSelect={selectProfile}
        onCreate={createProfile}
        onPlacement={course.placement && createForPlacement}
      />
    )
  else if (screen.name === 'session')
    body = (
      <SessionScreen
        mode={screen.mode}
        course={course}
        progress={current}
        minutes={screen.minutes}
        plan={screen.plan}
        onProgress={(p) => void saveProgress(p)}
        onEnd={endSession}
      />
    )
  else if (screen.name === 'exam' && course.exams?.[screen.level])
    body = (
      <ExamScreen
        mode={screen.mode}
        course={course}
        exam={course.exams[screen.level]!}
        progress={current}
        onDone={(p, record) => {
          void saveProgress(p)
          setScreen({ name: 'examResult', record })
        }}
        onQuit={() => setScreen({ name: 'home' })}
      />
    )
  else if (screen.name === 'examResult')
    body = (
      <ExamResult
        course={course}
        record={screen.record}
        weakUnits={current.weakUnits}
        onHome={() => setScreen({ name: 'home' })}
      />
    )
  else if (screen.name === 'goal')
    body = (
      <GoalScreen
        level={current.level}
        goal={current.goal}
        onSave={(goal) => {
          void saveProgress({ ...current, goal })
          setScreen({ name: 'home' })
        }}
        onCancel={() => setScreen({ name: 'home' })}
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
        onPractice={(mode, minutes) =>
          setScreen({
            name: 'session',
            mode,
            minutes,
            plan: buildPracticeSession(course, current, minutes, new Date())
          })
        }
        onExam={(mode, level) => setScreen({ name: 'exam', mode, level })}
        onGoal={() => setScreen({ name: 'goal' })}
        onSwitchProfile={() => setScreen({ name: 'profiles' })}
        onAiSettings={() =>
          void window.api
            .aiStatus()
            .catch(() => ai)
            .then((s) => {
              if (!s) return
              setAi(s)
              setScreen({ name: 'setup' })
            })
        }
      />
    )

  return (
    <>
      {recoveredFrom && !['session', 'exam', 'placement'].includes(screen.name) && (
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
      <AudioIndexContext.Provider value={course.audio}>{body}</AudioIndexContext.Provider>
    </>
  )
}
