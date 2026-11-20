import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Plus, Bold, Italic, Image, Mic, Trash2 } from "lucide-react";
import { useSession } from "../app/store";
import { examples, today, formatDate, type JournalEntry, type MoodValue } from "../domain/models";
import {
  PageHeader,
  EmptyState,
  Notice,
  MoodPicker,
  EnergyPicker,
  Activities,
  Dialog,
} from "../components/ui";
import { errorMessage } from "../application/errors";
import { searchEntries } from "../application/search";
import MediaPreview from "../components/MediaPreview";
import { acceptedMedia, prepareMedia } from "../application/media";

export function Journal() {
  const { entries } = useSession();
  const [showExamples, setShowExamples] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tag, setTag] = useState("");
  const source = showExamples ? examples : entries;
  const displayed = searchEntries(source, { text: search, from, to, tag });
  return (
    <>
      <PageHeader
        eyebrow="PÁGINAS DE TU VIDA"
        title="Mi diario"
        description="Un lugar para escribir como eres, no como deberías ser."
      >
        <Link className="button primary" to="/diario/nueva">
          <Plus size={17} />
          Nueva entrada
        </Link>
      </PageHeader>
      <div className="filter-bar">
        <div className="tabs">
          <button className={!showExamples ? "active" : ""} onClick={() => setShowExamples(false)}>
            Mis entradas ({entries.length})
          </button>
          <button className={showExamples ? "active" : ""} onClick={() => setShowExamples(true)}>
            Explorar ejemplos
          </button>
        </div>
        <input
          aria-label="Buscar en el diario"
          placeholder="Buscar entre tus palabras…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="filter-bar">
        <label>
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          Etiqueta
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">Todas</option>
            {[...new Set(source.flatMap((entry) => entry.tags))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {showExamples && (
        <Notice>Contenido ilustrativo. Estos recuerdos no pertenecen a tu diario.</Notice>
      )}
      {displayed.length ? (
        <div className="journal-list">
          {displayed.map((entry) => (
            <Link className="journal-row" key={entry.id} to={`/diario/${entry.id}`}>
              <div className="journal-date">
                <strong>{new Date(`${entry.entryDate}T12:00:00`).getDate()}</strong>
                <span>
                  {formatDate(entry.entryDate, {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div>
                <h2>
                  {entry.title || "Sin título"}{" "}
                  {entry.status === "draft" && <span className="chip">Borrador recuperable</span>}
                </h2>
                <p>{entry.content}</p>
                <div className="chips">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span>↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={search ? "No encontramos esas palabras" : "Tu historia comienza con una página"}
        >
          {search ? (
            "Prueba con otra palabra o cambia de vista."
          ) : (
            <>
              <span>Escribe mucho, poco o solo una frase. Este espacio no lleva la cuenta.</span>
              <Link to="/diario/nueva" className="button primary">
                Escribir mi primera entrada
              </Link>
            </>
          )}
        </EmptyState>
      )}
    </>
  );
}

export function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { entries, saveEntry, removeEntry } = useSession();
  const entry = [...entries, ...examples].find((item) => item.id === id);
  const navigate = useNavigate();
  const [title, setTitle] = useState(entry?.title || "");
  const [content, setContent] = useState(entry?.content || "");
  const requestedDate = params.get("fecha") || "";
  const [date, setDate] = useState(
    entry?.entryDate || (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today()),
  );
  const [tags, setTags] = useState(entry?.tags.join(", ") || "");
  const [activities, setActivities] = useState(entry?.activityReferences || []);
  const [mood, setMood] = useState<MoodValue | undefined>(entry?.moodRecord?.moodValue);
  const [energy, setEnergy] = useState<number | undefined>(entry?.energyRecord?.energyValue);
  const [eventTitle, setEventTitle] = useState(entry?.significantEvent?.title || "");
  const [status, setStatus] = useState(
    entry
      ? entry.status === "draft"
        ? "Borrador recuperado del dispositivo"
        : "Guardado en el dispositivo"
      : "Borrador · sin guardar",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mediaIds, setMediaIds] = useState(entry?.mediaReferences || []);
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const stableId = useRef(id || crypto.randomUUID());
  const expectedVersion = useRef(entry?.updatedAt);
  const initiallyAvailable = useRef(!!entry);
  const [unsaved, setUnsaved] = useState(false);
  const changed = useRef(false);
  const blocker = useBlocker(() => changed.current);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  const dirty = () => {
    changed.current = true;
    setStatus("Cambios pendientes");
    setUnsaved(true);
  };
  const format = (marker: string) => {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    setContent(
      `${content.slice(0, start)}${marker}${content.slice(start, end)}${marker}${content.slice(end)}`,
    );
    dirty();
    field.focus();
  };
  if (id && !entry && !initiallyAvailable.current)
    return (
      <EmptyState title="Esta entrada no está disponible">
        <Link to="/diario">Volver a mi diario</Link>
      </EmptyState>
    );
  const save = async (draft = false) => {
    if (busy) return;
    if (!draft && !content.trim()) {
      setError(
        "Escribe al menos unas palabras antes de guardar. El título y los demás campos son opcionales.",
      );
      return;
    }
    if (!date) {
      setError("Elige una fecha para esta entrada.");
      return;
    }
    const now = new Date().toISOString();
    const updated: JournalEntry = {
      id: stableId.current,
      title: title.trim(),
      content,
      entryDate: date,
      createdAt: entry?.createdAt || now,
      updatedAt: now,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      activityReferences: activities,
      mediaReferences: mediaIds,
      status: draft ? "draft" : "saved",
      moodRecord: mood
        ? {
            id: `mood-${stableId.current}`,
            entryReference: stableId.current,
            recordedAt: now,
            moodValue: mood,
          }
        : undefined,
      energyRecord: energy
        ? {
            id: `energy-${stableId.current}`,
            entryReference: stableId.current,
            recordedAt: now,
            energyValue: energy,
            scaleDefinition: { min: 1, max: 5 },
          }
        : undefined,
      significantEvent: eventTitle
        ? {
            id: `event-${stableId.current}`,
            title: eventTitle,
            eventDate: date,
            tags: [],
            mediaReferences: [],
            journalEntryReference: stableId.current,
          }
        : undefined,
    };
    setBusy(true);
    setError("");
    setStatus("Guardando en el dispositivo…");
    try {
      const saved = await saveEntry(updated, files, expectedVersion.current);
      expectedVersion.current = saved.updatedAt;
      setFiles([]);
      setMediaIds(saved.mediaReferences);
      setUnsaved(false);
      changed.current = false;
      setStatus(
        draft ? "Borrador guardado · recuperable desde Mi diario" : "Guardado en el dispositivo",
      );
      if (!id) navigate(`/diario/${stableId.current}`, { replace: true });
    } catch (error) {
      setError(errorMessage(error));
      setStatus("No se ha guardado · tu texto sigue aquí");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="editor-top">
        <Link to="/diario">
          <ArrowLeft size={16} />
          Mi diario
        </Link>
        <span>{entry?.example ? "Contenido de ejemplo · solo lectura" : status}</span>
      </div>
      <PageHeader
        eyebrow={entry?.example ? "UNA PÁGINA ILUSTRATIVA" : "ESTE MOMENTO ES TUYO"}
        title={entry?.example ? entry.title || "Recuerdo de ejemplo" : "Una nueva página"}
        description="No hay nada que demostrar. Solo un poco de espacio para ti."
      />
      {entry?.example ? (
        <>
          <Notice>
            Ejemplo separado de tus registros. No se puede modificar ni guardar como recuerdo
            personal.
          </Notice>
          {entry.mediaReferences[0] && (
            <img
              className="entry-photo"
              src={entry.mediaReferences[0]}
              alt="Fotografía ilustrativa del recuerdo"
            />
          )}
          <div className="reading">
            <p className="eyebrow">{formatDate(entry.entryDate)}</p>
            <p>{entry.content}</p>
            <div className="chips">
              {entry.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Link className="button primary" to="/diario/nueva">
            Escribir mi propia historia
          </Link>
        </>
      ) : (
        <>
          <Notice>
            Guardado local en este navegador. Usa «Guardar borrador» para recuperar una página
            incompleta, y crea respaldos desde Administración.
          </Notice>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="editor-layout"
          >
            <section className="writing-paper">
              <div className="paper-meta">
                <label>
                  Fecha
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      dirty();
                    }}
                  />
                </label>
                <span>
                  {new Date(entry?.createdAt || Date.now()).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <input
                className="title-input"
                aria-label="Título opcional"
                placeholder="Ponle un título, si quieres…"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  dirty();
                }}
              />
              <div className="format-bar">
                <button
                  type="button"
                  title="Negrita: marcadores de texto"
                  aria-label="Insertar marcadores de negrita"
                  onClick={() => format("**")}
                >
                  <Bold size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Insertar marcadores de cursiva"
                  onClick={() => format("_")}
                >
                  <Italic size={17} />
                </button>
                <span>Formato con marcadores de texto</span>
                <button
                  type="button"
                  title="Adjuntar fotografías"
                  aria-label="Adjuntar fotografías"
                  onClick={() => {
                    if (fileInput.current) {
                      fileInput.current.accept = "image/jpeg,image/png,image/webp";
                      fileInput.current.click();
                    }
                  }}
                >
                  <Image size={17} />
                </button>
                <button
                  type="button"
                  title="Adjuntar grabación"
                  aria-label="Adjuntar grabación"
                  onClick={() => {
                    if (fileInput.current) {
                      fileInput.current.accept =
                        "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4";
                      fileInput.current.click();
                    }
                  }}
                >
                  <Mic size={17} />
                </button>
              </div>
              <input
                hidden
                type="file"
                ref={fileInput}
                accept={acceptedMedia}
                multiple
                aria-label="Archivos adjuntos"
                onChange={async (event) => {
                  const selected = Array.from(event.target.files || []);
                  event.target.value = "";
                  setBusy(true);
                  try {
                    await Promise.all(selected.map(prepareMedia));
                    setFiles((previous) => [...previous, ...selected]);
                    dirty();
                    setError("");
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <textarea
                ref={textarea}
                className="journal-textarea"
                aria-label="Contenido de la entrada"
                placeholder="Empieza por lo que tienes en mente…"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  dirty();
                }}
              />
              <p className="paper-foot">
                {content.trim() ? content.trim().split(/\s+/).length : 0} palabras · Sin prisa, sin
                una extensión ideal.
              </p>
              <div className="attachment-list">
                {mediaIds.map((mediaId) => (
                  <div key={mediaId}>
                    <MediaPreview id={mediaId} className="attachment-preview" />
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setMediaIds((previous) => previous.filter((value) => value !== mediaId));
                        dirty();
                      }}
                    >
                      Desvincular archivo
                    </button>
                  </div>
                ))}
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`}>
                    <span>{file.name} · pendiente de guardar</span>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setFiles((previous) =>
                          previous.filter((_, position) => position !== index),
                        );
                        dirty();
                      }}
                    >
                      Retirar {file.name}
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <aside className="editor-options">
              <h3>Un poco de contexto</h3>
              <p className="muted small">Todo aquí es opcional.</p>
              <fieldset>
                <legend>¿Cómo te sientes?</legend>
                <MoodPicker
                  value={mood}
                  onChange={(value) => {
                    setMood(value);
                    dirty();
                  }}
                />
              </fieldset>
              <fieldset>
                <legend>Energía percibida</legend>
                <EnergyPicker
                  value={energy}
                  onChange={(value) => {
                    setEnergy(value);
                    dirty();
                  }}
                />
              </fieldset>
              <fieldset>
                <legend>Actividades</legend>
                <Activities
                  value={activities}
                  onChange={(value) => {
                    setActivities(value);
                    dirty();
                  }}
                />
              </fieldset>
              <label>
                Etiquetas
                <input
                  aria-label="Etiquetas"
                  placeholder="Naturaleza, familia…"
                  value={tags}
                  onChange={(event) => {
                    setTags(event.target.value);
                    dirty();
                  }}
                />
                <small>Separadas por comas</small>
              </label>
              <label>
                Acontecimiento significativo
                <input
                  placeholder="Algo que quieras destacar"
                  value={eventTitle}
                  onChange={(event) => {
                    setEventTitle(event.target.value);
                    dirty();
                  }}
                />
              </label>
              <p className="small muted">
                Fotografías y grabaciones: hasta 25 MB por archivo. Desvincular no elimina el
                archivo de Recuerdos. No hay grabación con micrófono integrada.
              </p>
            </aside>
            <div className="editor-actions">
              {error && <Notice error>{error}</Notice>}
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog("cancel")}
              >
                Volver sin guardar
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Guardar borrador
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar entrada"}
              </button>
              {entry && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Eliminar entrada"
                  onClick={() => setDialog("delete")}
                >
                  <Trash2 size={19} />
                </button>
              )}
            </div>
          </form>
        </>
      )}
      {dialog && (
        <Dialog
          title={dialog === "delete" ? "¿Eliminar esta entrada?" : "¿Salir del editor?"}
          onClose={() => setDialog(null)}
        >
          <p>
            {dialog === "delete"
              ? "Se eliminarán la entrada y sus registros de ánimo, energía y actividad vinculados. Sus archivos y acontecimientos se conservan como recuerdos independientes. No puede deshacerse sin un respaldo."
              : "Los cambios que no hayas guardado se descartarán."}
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Seguir aquí
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (dialog === "delete") await removeEntry(stableId.current);
                  setUnsaved(false);
                  changed.current = false;
                  navigate("/diario");
                } catch (error) {
                  setError(errorMessage(error));
                  setDialog(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {dialog === "delete" ? "Eliminar" : "Salir sin guardar"}
            </button>
          </div>
        </Dialog>
      )}
      {blocker.state === "blocked" && (
        <Dialog title="Tienes cambios sin guardar" onClose={() => blocker.reset()}>
          <p>
            Tu texto todavía no se ha guardado. Puedes quedarte y guardar un borrador antes de
            salir.
          </p>
          <div className="dialog-actions">
            <button className="button primary" onClick={() => blocker.reset()}>
              Seguir escribiendo
            </button>
            <button
              className="button secondary"
              onClick={() => {
                changed.current = false;
                blocker.proceed();
              }}
            >
              Descartar cambios y salir
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
