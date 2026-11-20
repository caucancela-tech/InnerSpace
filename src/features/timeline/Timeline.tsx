import { useState } from "react";
import { Link } from "react-router";
import { Plus, ArrowUpRight } from "lucide-react";
import { useSession } from "../../app/store";
import { examples, formatDate, today } from "../../domain/models";
import type { StoredEvent } from "../../domain/validation";
import { timelineService } from "../../application/timeline";
import { errorMessage } from "../../application/errors";
import { PageHeader, EmptyState, Notice, Dialog } from "../../components/ui";
import MediaPreview from "../../components/MediaPreview";

export default function Timeline() {
  const { lifeEvents, entries, mediaAssets } = useSession();
  const [example, setExample] = useState(false);
  const [period, setPeriod] = useState("all");
  const [tag, setTag] = useState("all");
  const [editing, setEditing] = useState<StoredEvent | null>(null);
  const [deleting, setDeleting] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const source: StoredEvent[] = example
    ? examples.map((entry) => ({
        id: entry.id,
        title: entry.title!,
        description: entry.content,
        eventDate: entry.entryDate,
        tags: entry.tags,
        mediaReferences: entry.mediaReferences,
        journalEntryReference: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }))
    : lifeEvents;
  const records = source
    .filter(
      (event) =>
        (period === "all" || event.eventDate.startsWith(period)) &&
        (tag === "all" || event.tags.includes(tag)),
    )
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return (
    <>
      <PageHeader
        eyebrow="EL HILO DE TU HISTORIA"
        title="Línea temporal"
        description="Lo que te ha marcado. Lo que cambió. Lo que simplemente fue."
      >
        <button
          className="button primary"
          onClick={() => {
            const now = new Date().toISOString();
            setEditing({
              id: crypto.randomUUID(),
              title: "",
              description: "",
              eventDate: today(),
              tags: [],
              mediaReferences: [],
              createdAt: now,
              updatedAt: now,
            });
            setError("");
          }}
        >
          <Plus size={17} />
          Nuevo acontecimiento
        </button>
      </PageHeader>
      <div className="filter-bar">
        <div className="tabs">
          <button className={!example ? "active" : ""} onClick={() => setExample(false)}>
            Mis acontecimientos
          </button>
          <button className={example ? "active" : ""} onClick={() => setExample(true)}>
            Ejemplos
          </button>
        </div>
        <div className="view-controls">
          <select
            aria-label="Periodo"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="all">Todos los periodos</option>
            {[...new Set(source.map((event) => event.eventDate.slice(0, 7)))].map((value) => (
              <option key={value} value={value}>
                {formatDate(`${value}-01`, { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          <select
            aria-label="Etiqueta"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">Todas las etiquetas</option>
            {[...new Set(source.flatMap((event) => event.tags))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      {example && (
        <Notice>
          Acontecimientos ilustrativos. No se cuentan ni se guardan como datos personales.
        </Notice>
      )}
      {error && !editing && <Notice error>{error}</Notice>}
      {records.length ? (
        <div className="timeline">
          {records.map((event, index) => (
            <div key={event.id}>
              {(index === 0 ||
                records[index - 1].eventDate.slice(0, 7) !== event.eventDate.slice(0, 7)) && (
                <h2 className="timeline-month">
                  {formatDate(event.eventDate, { month: "long", year: "numeric" })}
                </h2>
              )}
              <article className="timeline-item">
                <div className="timeline-point" />
                <p className="eyebrow">{formatDate(event.eventDate)}</p>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                {event.mediaReferences[0] &&
                  (example ? (
                    <img src={event.mediaReferences[0]} alt="Paisaje ilustrativo" />
                  ) : (
                    <MediaPreview id={event.mediaReferences[0]} className="entry-photo" />
                  ))}
                {event.journalEntryReference && (
                  <Link to={`/diario/${event.journalEntryReference}`}>
                    Volver a la entrada <ArrowUpRight size={15} />
                  </Link>
                )}
                {!example && (
                  <div className="dialog-actions">
                    <button
                      className="button secondary"
                      onClick={() => {
                        setEditing(event);
                        setError("");
                      }}
                    >
                      Editar acontecimiento
                    </button>
                    <button className="text-button" onClick={() => setDeleting(event.id)}>
                      Eliminar acontecimiento
                    </button>
                  </div>
                )}
              </article>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Los momentos encontrarán su lugar">
          Crea un acontecimiento independiente o destácalo desde el editor. No tiene que ser un
          logro.
        </EmptyState>
      )}
      {editing && (
        <Dialog
          title="Tu acontecimiento"
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await timelineService.save({ ...editing, updatedAt: new Date().toISOString() });
                setEditing(null);
                setError("");
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Título del acontecimiento
              <input
                required
                maxLength={250}
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </label>
            <label>
              Fecha del acontecimiento
              <input
                type="date"
                required
                value={editing.eventDate}
                onChange={(event) => setEditing({ ...editing, eventDate: event.target.value })}
              />
            </label>
            <label>
              Lo que quieres recordar
              <textarea
                value={editing.description || ""}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </label>
            <label>
              Entrada relacionada
              <select
                value={editing.journalEntryReference || ""}
                onChange={(event) =>
                  setEditing({ ...editing, journalEntryReference: event.target.value || undefined })
                }
              >
                <option value="">Sin entrada · recuerdo independiente</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title || "Sin título"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etiquetas del acontecimiento
              <input
                value={editing.tags.join(", ")}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    tags: event.target.value.split(",").map((tag) => tag.trim()),
                  })
                }
              />
            </label>
            <label>
              Archivo relacionado
              <select
                value={editing.mediaReferences[0] || ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    mediaReferences: event.target.value ? [event.target.value] : [],
                  })
                }
              >
                <option value="">Sin archivo</option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.filename}
                  </option>
                ))}
              </select>
            </label>
            {error && <Notice error>{error}</Notice>}
            <button className="button primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar acontecimiento"}
            </button>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="¿Eliminar este acontecimiento?" onClose={() => setDeleting(undefined)}>
          <p>
            Se eliminará de la línea temporal. La entrada y los archivos relacionados se
            conservarán.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await timelineService.remove(deleting);
                setDeleting(undefined);
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
