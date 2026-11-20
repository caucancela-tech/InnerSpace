import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../../app/store";
import { today, formatDate, type MoodValue } from "../../domain/models";
import {
  PageHeader,
  Notice,
  MoodPicker,
  EnergyPicker,
  Activities,
  Dialog,
} from "../../components/ui";
import { errorMessage } from "../../application/errors";

export default function Checkin() {
  const {
    checkins,
    saveCheckin,
    removeCheckin,
    activities: catalog,
    moods,
    energies,
  } = useSession();
  const [params] = useSearchParams();
  const [date, setDate] = useState(params.get("fecha") || today());
  const existing = checkins.find((record) => record.date === date);
  const [mood, setMood] = useState<MoodValue | undefined>(existing?.mood?.moodValue);
  const [energy, setEnergy] = useState<number | undefined>(existing?.energy?.energyValue);
  const [activities, setActivities] = useState<string[]>(existing?.activities || []);
  const [context, setContext] = useState(existing?.context || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const open = (value: string) => {
    const record = checkins.find((item) => item.date === value);
    setDate(value);
    setMood(record?.mood?.moodValue);
    setEnergy(record?.energy?.energyValue);
    setActivities(record?.activities || []);
    setContext(record?.context || "");
    setMessage("");
    setError("");
  };
  return (
    <>
      <PageHeader
        eyebrow="UN INSTANTE PARA ESCUCHARTE"
        title="¿Cómo estás, de verdad?"
        description="Sin respuestas correctas. Puedes registrar solo lo que te apetezca."
      />
      <form
        className="personal-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          const now = new Date().toISOString();
          try {
            await saveCheckin({
              date,
              context,
              activities,
              mood: mood ? { id: `mood-${date}`, recordedAt: now, moodValue: mood } : undefined,
              energy: energy
                ? {
                    id: `energy-${date}`,
                    recordedAt: now,
                    energyValue: energy,
                    scaleDefinition: { min: 1, max: 5 },
                  }
                : undefined,
            });
            setMessage("Registro guardado en el dispositivo. Puedes editarlo aquí.");
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Notice>
          Registro voluntario y no clínico. Un registro breve por día; al actualizar se sustituye el
          de esa fecha. Los registros vinculados a entradas se conservan por separado.
        </Notice>
        <label>
          Fecha del registro
          <input type="date" required value={date} onChange={(event) => open(event.target.value)} />
        </label>
        <fieldset>
          <legend>Mi estado de ánimo</legend>
          <MoodPicker value={mood} onChange={setMood} />
        </fieldset>
        <fieldset>
          <legend>Mi energía percibida</legend>
          <EnergyPicker value={energy} onChange={setEnergy} />
        </fieldset>
        <fieldset>
          <legend>Lo que me ha acompañado</legend>
          <Activities value={activities} onChange={setActivities} />
        </fieldset>
        <label>
          Algo de contexto, si quieres
          <textarea
            maxLength={10_000}
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="¿Qué te gustaría añadir sobre este momento?"
          />
        </label>
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <div className="dialog-actions">
          <Link to="/" className="button secondary">
            Volver
          </Link>
          {existing && (
            <button type="button" className="button secondary" onClick={() => setDeleting(true)}>
              Eliminar registro breve
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Guardando…" : existing ? "Actualizar registro" : "Guardar registro"}
          </button>
        </div>
      </form>
      <section className="history-panel">
        <h2>Cómo te has ido sintiendo</h2>
        <p className="muted">Historial descriptivo, sin diagnósticos ni puntuaciones de salud.</p>
        <ul className="record-list">
          {checkins.map((record) => (
            <li key={record.date}>
              <button className="text-button" onClick={() => open(record.date)}>
                {formatDate(record.date, { day: "numeric", month: "long", year: "numeric" })}
              </button>
              <span>
                {record.mood?.moodValue || "Sin ánimo registrado"} ·{" "}
                {record.energy
                  ? `Energía ${record.energy.energyValue}/5`
                  : "Sin energía registrada"}
              </span>
              <span>
                {record.activities
                  .map((id) => catalog.find((activity) => activity.id === id)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
        <h3>Registros asociados al diario</h3>
        {[
          ...new Set(
            [...moods, ...energies]
              .filter((record) => record.entryReference)
              .map((record) => record.entryReference!),
          ),
        ].map((id) => (
          <Link className="day-entry" key={id} to={`/diario/${id}`}>
            {moods.find((record) => record.entryReference === id)?.moodValue ||
              "Registro de energía"}{" "}
            · {energies.find((record) => record.entryReference === id)?.energyValue || "—"}/5 · Ver
            entrada
          </Link>
        ))}
      </section>
      {deleting && (
        <Dialog title="¿Eliminar el registro breve?" onClose={() => setDeleting(false)}>
          <p>
            Se eliminarán el contexto, ánimo, energía y asociaciones de actividades de este registro
            del día. Las entradas de diario no cambiarán.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await removeCheckin(date);
                setMood(undefined);
                setEnergy(undefined);
                setActivities([]);
                setContext("");
                setDeleting(false);
                setMessage("Registro eliminado.");
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar eliminación
          </button>
        </Dialog>
      )}
    </>
  );
}
