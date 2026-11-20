import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { JournalEntry, Reflection } from "../domain/models";
import { readSnapshot } from "../application/snapshot";
import { journalService } from "../application/journal";
import { checkinService, type Checkin } from "../application/checkins";
import { reflectionService } from "../application/reflections";
import { errorMessage } from "../application/errors";
import Setup from "../features/administration/Setup";
import { preferencesService, type PreferencesPatch } from "../application/preferences";

function useLocalState() {
  const result = useLiveQuery(async () => {
    try {
      return { ok: true as const, data: await readSnapshot() };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error) };
    }
  }, []);
  const [operation, setOperation] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [storageError, setStorageError] = useState("");
  const pending = useRef(0);
  const failed = useRef(false);
  async function run<T>(action: () => Promise<T>): Promise<T> {
    if (pending.current === 0) {
      failed.current = false;
      setStorageError("");
    }
    pending.current += 1;
    setOperation("saving");
    try {
      const value = await action();
      return value;
    } catch (error) {
      failed.current = true;
      setStorageError(errorMessage(error));
      throw error;
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setOperation(failed.current ? "error" : "saved");
    }
  }
  return {
    result,
    operation,
    storageError,
    saveEntry: (entry: JournalEntry, files?: File[], expectedUpdatedAt?: string) =>
      run(() => journalService.save(entry, files, expectedUpdatedAt)),
    removeEntry: (id: string) => run(() => journalService.remove(id)),
    saveReflection: (reflection: Reflection) => run(() => reflectionService.save(reflection)),
    saveCheckin: (record: Checkin) => run(() => checkinService.save(record)),
    removeCheckin: (date: string) => run(() => checkinService.remove(date)),
    setPreferences: (preferences: PreferencesPatch) => {
      // Event handlers need not catch this promise: errors are surfaced in the persistent shell.
      void run(() => preferencesService.update(preferences)).catch(() => {});
    },
  };
}
type LocalState = ReturnType<typeof useLocalState>;
type Session = Omit<LocalState, "result"> & Awaited<ReturnType<typeof readSnapshot>>;
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { result, ...actions } = useLocalState();
  if (!result)
    return (
      <div className="app">
        <section className="setup-card">
          <p role="status">Abriendo tu espacio local…</p>
          <p>Inicializando la base de datos del dispositivo.</p>
        </section>
      </div>
    );
  if (!result.ok)
    return (
      <div className="app">
        <section className="setup-card">
          <h1>No podemos abrir tu espacio</h1>
          <p role="alert">{result.error}</p>
          <button className="button primary" onClick={() => location.reload()}>
            Reintentar sin borrar datos
          </button>
        </section>
      </div>
    );
  if (!result.data.initialized) return <Setup />;
  return (
    <SessionContext.Provider value={{ ...result.data, ...actions }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider no disponible");
  return session;
}
