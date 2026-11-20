import { ArrowUpRight, Smile, Sun, Cloud, Moon, Wind, X } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { MoodValue, JournalEntry } from "../domain/models";
import { formatDate } from "../domain/models";
import { useSession } from "../app/store";
import MediaPreview from "./MediaPreview";
import { useState } from "react";
import { activityService } from "../application/activities";
import { errorMessage } from "../application/errors";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Wind size={26} strokeWidth={1.3} />
      <h3>{title}</h3>
      <div className="empty-description">
        {children || "Aquí hay espacio para lo que quieras guardar. A tu ritmo."}
      </div>
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p role={error ? "alert" : "status"} className={`notice ${error ? "error" : ""}`}>
      {children}
    </p>
  );
}
const moods: { value: MoodValue; icon: typeof Smile }[] = [
  { value: "En calma", icon: Wind },
  { value: "Con alegría", icon: Sun },
  { value: "Con nostalgia", icon: Moon },
  { value: "Con inquietud", icon: Cloud },
  { value: "Sin definir", icon: Smile },
];
export function MoodPicker({
  value,
  onChange,
}: {
  value?: MoodValue;
  onChange: (value: MoodValue | undefined) => void;
}) {
  return (
    <div className="moods">
      {moods.map(({ value: mood, icon: Icon }) => (
        <button
          type="button"
          key={mood}
          aria-pressed={value === mood}
          className={value === mood ? "selected" : ""}
          onClick={() => onChange(value === mood ? undefined : mood)}
        >
          <Icon size={23} strokeWidth={1.4} />
          <span>{mood}</span>
        </button>
      ))}
    </div>
  );
}
export function EnergyPicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div>
      <div className="energy">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            type="button"
            key={level}
            aria-label={`Energía ${level} de 5`}
            aria-pressed={value === level}
            className={value === level ? "selected" : ""}
            onClick={() => onChange(value === level ? undefined : level)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="scale-labels">
        <span>Necesito descansar</span>
        <span>Con mucha energía</span>
      </div>
    </div>
  );
}
export function Activities({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { activities } = useSession();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div className="chips">
        {activities.map((activity) => (
          <button
            type="button"
            key={activity.id}
            aria-pressed={value.includes(activity.id)}
            className={`chip ${value.includes(activity.id) ? "selected" : ""}`}
            onClick={() =>
              onChange(
                value.includes(activity.id)
                  ? value.filter((item) => item !== activity.id)
                  : [...value, activity.id],
              )
            }
          >
            {activity.name}
          </button>
        ))}
      </div>
      <div className="add-category">
        <input
          aria-label="Nueva actividad personal"
          maxLength={80}
          placeholder="Una actividad tuya…"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
        />
        <button
          className="button secondary"
          type="button"
          disabled={busy || !custom.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const existing = activities.find((activity) => activity.name === custom.trim());
              const activity = existing || (await activityService.save(custom));
              onChange([...new Set([...value, activity.id])]);
              setCustom("");
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Añadir actividad
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
export function MemoryCard({ entry }: { entry: JournalEntry }) {
  return (
    <Link to={`/diario/${entry.id}`} className="memory-card">
      {entry.mediaReferences[0] && !entry.example ? (
        <MediaPreview id={entry.mediaReferences[0]} previewOnly />
      ) : entry.mediaReferences[0] ? (
        <img src={entry.mediaReferences[0]} alt={entry.title || "Paisaje ilustrativo"} />
      ) : (
        <div className="text-memory">
          <span>“</span>
          <p>{entry.content}</p>
        </div>
      )}
      <div className="memory-meta">
        <span>{formatDate(entry.entryDate)}</span>
        <ArrowUpRight size={15} />
      </div>
      <h3>{entry.title || "Un momento para recordar"}</h3>
      <p className="memory-excerpt">{entry.content}</p>
      <span className="memory-tag">
        {entry.example ? "Contenido de ejemplo" : "Guardado en este dispositivo"}
      </span>
    </Link>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
