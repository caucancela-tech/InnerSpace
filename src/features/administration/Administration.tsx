import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Database,
  ShieldCheck,
  Lock,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import { auth } from "../../application/auth";
import { administrationService } from "../../application/administration";
import { errorMessage } from "../../application/errors";
import { privacyDisclosure } from "../../application/privacy";
import { PageHeader, Notice, Dialog } from "../../components/ui";
import { useSession } from "../../app/store";
import BackupPanel from "./BackupPanel";
import SecurityPanel from "./SecurityPanel";

const labels: Record<string, string> = {
  journalEntries: "Entradas",
  lifeEvents: "Acontecimientos",
  reflections: "Reflexiones",
  mediaAssets: "Archivos",
  moodRecords: "Ánimo",
  energyRecords: "Energía",
  activities: "Actividades",
  activityRecords: "Asociaciones de actividad",
  tags: "Etiquetas",
  dailyRecords: "Registros breves",
  mediaBlobs: "Binarios",
  preferences: "Preferencias",
  appSettings: "Configuración",
};
const size = (bytes?: number) =>
  bytes === undefined ? "No disponible" : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

export default function Administration() {
  const state = useSyncExternalStore(auth.subscribe, auth.snapshot);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => auth.valid(), 1000);
    const activity = () => auth.touch();
    const restore = () => setRestored(true);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("innerspace-restored", restore);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("innerspace-restored", restore);
    };
  }, []);
  if (state !== "active")
    return (
      <>
        <PageHeader
          eyebrow="CONTROL LOCAL"
          title="Administración"
          description="El cuidado de tu espacio, separado de tu escritura."
        />
        <section className="admin-access">
          <ShieldCheck size={32} strokeWidth={1.3} />
          <h2>{state === "expired" ? "Tu sesión ha expirado" : "Un acceso solo para ti"}</h2>
          <p>
            {state === "expired"
              ? "El panel se bloqueó por inactividad o por alcanzar su duración máxima. Tus datos se conservan."
              : "Desbloquea para consultar el sistema, crear respaldos y realizar mantenimiento."}
          </p>
          {restored && (
            <Notice>
              Restauración completada. Tus datos y archivos ya están disponibles; vuelve a
              desbloquear el panel para comprobarlos.
            </Notice>
          )}
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                await auth.login(password);
                setPassword("");
                setRestored(false);
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Contraseña administrativa
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <Notice error>{error}</Notice>}
            <button className="button primary" disabled={busy}>
              <Lock size={16} />
              {busy ? "Verificando…" : "Desbloquear administración"}
            </button>
          </form>
          <p className="muted small">{privacyDisclosure}</p>
        </section>
      </>
    );
  return <Dashboard />;
}

function Dashboard() {
  const { operation, storageError, entries, lifeEvents, reflections, mediaAssets, checkins } =
    useSession();
  const [summary, setSummary] =
    useState<Awaited<ReturnType<typeof administrationService.summary>>>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [clean, setClean] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((previous) => previous + 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    administrationService
      .summary()
      .then((result) => {
        if (active) {
          setSummary(result);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, entries, lifeEvents, reflections, mediaAssets, checkins]);
  return (
    <>
      <PageHeader
        eyebrow="EL CUIDADO DE TU ESPACIO"
        title="Administración"
        description="Todo en este dispositivo. Sin conexiones, sin intermediarios."
      >
        <div className="view-controls">
          <button className="button secondary" disabled={loading} onClick={refresh}>
            <RefreshCw size={15} />
            Comprobar sistema
          </button>
          <button
            className="button secondary"
            onClick={() => void auth.lock().catch((error) => setError(errorMessage(error)))}
          >
            <Lock size={15} />
            Bloquear y cerrar sesión
          </button>
        </div>
      </PageHeader>
      <div className="admin-status">
        <span className="status-dot" />
        <span>
          {loading ? "Comprobando almacenamiento…" : "IndexedDB · InnerSpace"} · esquema{" "}
          {summary?.schema || "—"}
        </span>
        <span>Local-first 2.0</span>
      </div>
      {error && <Notice error>{error}</Notice>}
      {storageError && <Notice error>{storageError}</Notice>}
      {message && <Notice>{message}</Notice>}
      {summary && (
        <>
          <section className="admin-stats">
            {["journalEntries", "lifeEvents", "reflections", "mediaAssets"].map((name) => (
              <article key={name}>
                <span>{labels[name]}</span>
                <strong>{summary.counts[name]}</strong>
                <small>Registros reales</small>
              </article>
            ))}
          </section>
          <div className="admin-grid">
            <section className="admin-panel">
              <Database size={24} strokeWidth={1.3} />
              <h2>Una base coherente</h2>
              <p>
                Estado de las operaciones:{" "}
                {operation === "saving"
                  ? "Guardando"
                  : operation === "error"
                    ? "Error, requiere atención"
                    : operation === "saved"
                      ? "Última escritura completada"
                      : "En reposo"}
                .
              </p>
              <div className="integrity-result">
                {summary.problems.length ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}
                <span>
                  {summary.problems.length
                    ? `${summary.problems.length} incidencias detectadas`
                    : "Sin inconsistencias detectadas"}
                </span>
              </div>
              {summary.problems.length > 0 && (
                <ul>
                  {summary.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))}
                </ul>
              )}
              <details>
                <summary>Entidades y cantidades</summary>
                <dl className="counts-list">
                  {Object.entries(summary.counts).map(([name, count]) => (
                    <div key={name}>
                      <dt>{labels[name] || name}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              <details>
                <summary>Migraciones aplicadas</summary>
                {summary.migrations.map((row) => (
                  <p key={row.id}>
                    v{row.id} · {row.value}
                  </p>
                ))}
              </details>
              <p className="muted small">
                Comprobación de estructura, identificadores, ámbitos, fechas, referencias, binarios
                y asociaciones. No edita registros internos.
              </p>
            </section>
            <section className="admin-panel">
              <HardDrive size={24} strokeWidth={1.3} />
              <h2>Espacio para conservar</h2>
              <dl className="counts-list">
                <div>
                  <dt>Uso estimado del origen</dt>
                  <dd>{size(summary.estimate?.usage)}</dd>
                </div>
                <div>
                  <dt>Cuota estimada del origen</dt>
                  <dd>{size(summary.estimate?.quota)}</dd>
                </div>
                <div>
                  <dt>Tamaño exacto de tus archivos</dt>
                  <dd>{size(summary.bytes)}</dd>
                </div>
                <div>
                  <dt>Archivos sin referencias</dt>
                  <dd>{summary.orphans.length}</dd>
                </div>
                <div>
                  <dt>Almacenamiento duradero</dt>
                  <dd>{summary.persisted ? "Concedido" : "No concedido"}</dd>
                </div>
              </dl>
              <p className="muted small">
                Las estimaciones corresponden a todo el origen, incluida la caché, no solo a
                InnerSpace. La cuota puede cambiar; modo privado y políticas del navegador pueden
                impedir conservar datos.
              </p>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    const granted = await administrationService.requestPersistence();
                    setMessage(
                      granted
                        ? "El navegador concedió almacenamiento duradero. Sigue creando respaldos."
                        : "El navegador no concedió almacenamiento duradero. Los datos actuales no se han borrado.",
                    );
                    refresh();
                  } catch (error) {
                    setError(errorMessage(error));
                  }
                }}
              >
                Solicitar almacenamiento duradero
              </button>
              <button
                className="text-button"
                disabled={!summary.orphans.length}
                onClick={() => {
                  setClean(true);
                  setConfirmation("");
                }}
              >
                Revisar limpieza de archivos sin referencias
              </button>
              <h3>Último respaldo generado</h3>
              <p>
                {summary.lastBackup
                  ? new Date(summary.lastBackup.createdAt).toLocaleString("es")
                  : "Aún no has generado un respaldo"}
              </p>
            </section>
            <BackupPanel onUpdate={refresh} />
            <SecurityPanel minutes={summary.settings?.autoLockMinutes || 10} onUpdate={refresh} />
          </div>
          <section className="admin-panel audit-panel">
            <h2>Huella administrativa</h2>
            <p>Últimos 40 eventos del sistema, sin contenido del diario ni credenciales.</p>
            <ol>
              {summary.events.map((event) => (
                <li key={event.id}>
                  <time>{new Date(event.createdAt).toLocaleString("es")}</time>
                  <span>{event.action}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {clean && (
        <Dialog
          title="Archivos sin referencias"
          onClose={() => {
            if (!busy) setClean(false);
          }}
        >
          <p>
            {summary?.orphans.length} archivos no están vinculados a entradas ni acontecimientos.
            Pueden ser recuerdos conservados tras eliminar una entrada; no son errores.
          </p>
          <ul>
            {summary?.orphans.map((asset) => (
              <li key={asset.id}>{asset.filename}</li>
            ))}
          </ul>
          <Notice error>
            Eliminar borra los binarios de forma irreversible. Descarga primero un respaldo si
            deseas conservarlos.
          </Notice>
          <label>
            Escribe ELIMINAR
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button
            className="button primary"
            disabled={busy || confirmation !== "ELIMINAR"}
            onClick={async () => {
              setBusy(true);
              try {
                await administrationService.cleanOrphans(confirmation);
                setClean(false);
                refresh();
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Eliminar archivos sin referencias
          </button>
        </Dialog>
      )}
    </>
  );
}
