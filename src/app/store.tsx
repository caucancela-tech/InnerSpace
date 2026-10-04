import { createContext, useContext, useState, type ReactNode } from 'react'
import type { JournalEntry, Reflection, UserPreferences, MoodRecord, EnergyRecord } from '../domain/models'

function useSessionState() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [checkins, setCheckins] = useState<{ mood?: MoodRecord; energy?: EnergyRecord; activities: string[]; context: string; date: string }[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>({ theme: 'light', locale: 'es', dateFormat: 'long', accessibilityPreferences: { largeText: false, reducedMotion: false }, privacyPreferences: { externalConnections: false } })
  return { entries, reflections, checkins, preferences, setPreferences, saveEntry: (entry: JournalEntry) => setEntries(previous => [entry, ...previous.filter(item => item.id !== entry.id)]), removeEntry: (id: string) => setEntries(previous => previous.filter(item => item.id !== id)), saveReflection: (reflection: Reflection) => setReflections(previous => [reflection, ...previous.filter(item => item.id !== reflection.id)]), setCheckins }
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null)
export function SessionProvider({ children }: { children: ReactNode }) { const session = useSessionState(); return <SessionContext.Provider value={session}>{children}</SessionContext.Provider> }
export function useSession() { const session = useContext(SessionContext); if (!session) throw new Error('SessionProvider no disponible'); return session }
