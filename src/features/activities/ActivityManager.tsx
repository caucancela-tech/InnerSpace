import { useState } from "react";
import { useSession } from "../../app/store";
import { activityService } from "../../application/activities";
import { errorMessage } from "../../application/errors";
import { Notice, Dialog } from "../../components/ui";

export default function ActivityManager() {
  const { activities, activityRecords } = useSession();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Personal");
  const [id, setId] = useState<string>();
  const [remove, setRemove] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="settings-panel">
      <h2>Tus actividades</h2>
      <p className="muted">
        Un catálogo personal. Cambiar el nombre conserva su historia; eliminarlo retira sus
        asociaciones, no tus entradas.
      </p>
      <form
        className="catalog-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await activityService.save(name, category, id);
            setName("");
            setId(undefined);
            setMessage("Actividad guardada en el dispositivo.");
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nombre de actividad
          <input
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Categoría
          <input
            required
            maxLength={80}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {id ? "Actualizar actividad" : "Crear actividad"}
        </button>
        {id && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setId(undefined);
              setName("");
            }}
          >
            Cancelar edición
          </button>
        )}
      </form>
      {message && <Notice>{message}</Notice>}
      <ul className="record-list">
        {activities.map((activity) => (
          <li key={activity.id}>
            <div>
              <strong>{activity.name}</strong>
              <p>
                {activity.category} ·{" "}
                {activityRecords.filter((record) => record.activityId === activity.id).length}{" "}
                registros
              </p>
              <small>
                {activityRecords
                  .filter((record) => record.activityId === activity.id)
                  .map((record) => record.recordedAt)
                  .sort()
                  .reverse()
                  .join(" · ") || "Sin historial todavía"}
              </small>
            </div>
            <div>
              <button
                className="text-button"
                onClick={() => {
                  setId(activity.id);
                  setName(activity.name);
                  setCategory(activity.category);
                }}
              >
                Editar {activity.name}
              </button>
              <button className="text-button" onClick={() => setRemove(activity.id)}>
                Eliminar {activity.name}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {remove && (
        <Dialog title="¿Eliminar esta actividad?" onClose={() => setRemove(undefined)}>
          <p>
            Se retirará del catálogo y de todos sus registros y entradas. Las entradas y los otros
            datos se conservarán.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await activityService.remove(remove);
                setRemove(undefined);
                setMessage("Actividad eliminada.");
              } catch (error) {
                setMessage(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar eliminación
          </button>
        </Dialog>
      )}
    </section>
  );
}
