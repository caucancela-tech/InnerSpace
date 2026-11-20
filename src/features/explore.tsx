import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, Grid2X2, List, ArrowUpRight } from "lucide-react";
import { useSession } from "../app/store";
import { examples, formatDate, today, type JournalEntry } from "../domain/models";
import { PageHeader, EmptyState, Notice, Dialog } from "../components/ui";
import LocalMemories from "./memories/LocalMemories";
import { calendarDates } from "../application/calendar";

export function Calendar() {
  const [params] = useSearchParams();
  const { entries, checkins, lifeEvents } = useSession();
  const initial = params.get("fecha") || today();
  const safeInitial =
    /^\d{4}-\d{2}-\d{2}$/.test(initial) && !Number.isNaN(new Date(initial).getTime())
      ? initial
      : today();
  const [selected, setSelected] = useState(safeInitial);
  const [month, setMonth] = useState(new Date(`${safeInitial}T12:00:00`));
  const [example, setExample] = useState(false);
  const [list, setList] = useState(false);
  const [filter, setFilter] = useState("Todas las entradas");
  const records = (example ? examples : entries).filter(
    (entry) =>
      filter === "Todas las entradas" ||
      (filter === "Con recuerdos"
        ? entry.mediaReferences.length
        : filter === "Con actividades"
          ? entry.activityReferences.length
          : entry.significantEvent ||
            (!example && lifeEvents.some((event) => event.journalEntryReference === entry.id))),
  );
  const dateKey = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const selectedRecords = records.filter((entry) => entry.entryDate === selected);
  const daily = !example
    ? checkins.filter(
        (record) =>
          filter === "Todas las entradas" ||
          (filter === "Con actividades" && record.activities.length),
      )
    : [];
  const events =
    !example && (filter === "Todas las entradas" || filter === "Con acontecimientos")
      ? lifeEvents
      : [];
  const datesWithRecords = calendarDates(records, daily);
  for (const event of events) datesWithRecords.add(event.eventDate);
  const selectedCheckin = daily.find((record) => record.date === selected);
  const selectedEvents = events.filter((event) => event.eventDate === selected);
  return (
    <>
      <PageHeader
        eyebrow="LOS DÍAS QUE NOS HACEN"
        title="Tu calendario"
        description="Cada día tiene su espacio. También los que dejas en blanco."
      />
      <div className="filter-bar">
        <div className="tabs">
          <button className={!example ? "active" : ""} onClick={() => setExample(false)}>
            Mis registros
          </button>
          <button className={example ? "active" : ""} onClick={() => setExample(true)}>
            Ejemplos
          </button>
        </div>
        <div className="view-controls">
          <select
            aria-label="Filtrar calendario"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {["Todas las entradas", "Con recuerdos", "Con actividades", "Con acontecimientos"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <button
            className="icon-button"
            aria-label="Vista de calendario"
            aria-pressed={!list}
            onClick={() => setList(false)}
          >
            <Grid2X2 size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Vista de lista"
            aria-pressed={list}
            onClick={() => setList(true)}
          >
            <List size={19} />
          </button>
        </div>
      </div>
      {example && <Notice>Solo contenido de ejemplo. No representa tu actividad personal.</Notice>}
      <div className="calendar-layout">
        <section className="calendar-paper">
          <div className="month-navigation">
            <h2>
              {month.toLocaleDateString("es", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div>
              <button
                className="icon-button"
                aria-label="Mes anterior"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                className="button text-button"
                onClick={() => {
                  setMonth(new Date());
                  setSelected(today());
                }}
              >
                Hoy
              </button>
              <button
                className="icon-button"
                aria-label="Mes siguiente"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          {list ? (
            <div className="calendar-list">
              {records.filter((entry) => entry.entryDate.startsWith(dateKey(1).slice(0, 7))).length
                ? records
                    .filter((entry) => entry.entryDate.startsWith(dateKey(1).slice(0, 7)))
                    .map((entry) => (
                      <button key={entry.id} onClick={() => setSelected(entry.entryDate)}>
                        <span>{formatDate(entry.entryDate)}</span>
                        <strong>{entry.title || "Sin título"}</strong>
                      </button>
                    ))
                : !daily.some((record) => record.date.startsWith(dateKey(1).slice(0, 7))) &&
                  !events.some((event) => event.eventDate.startsWith(dateKey(1).slice(0, 7))) && (
                    <EmptyState title="Un mes aún por contar" />
                  )}
              {daily
                .filter((record) => record.date.startsWith(dateKey(1).slice(0, 7)))
                .map((record) => (
                  <button key={record.date} onClick={() => setSelected(record.date)}>
                    <span>{formatDate(record.date)}</span>
                    <strong>
                      Registro breve · {record.mood?.moodValue || "Contexto personal"}
                    </strong>
                  </button>
                ))}
              {events
                .filter((event) => event.eventDate.startsWith(dateKey(1).slice(0, 7)))
                .map((event) => (
                  <button key={event.id} onClick={() => setSelected(event.eventDate)}>
                    <span>{formatDate(event.eventDate)}</span>
                    <strong>Acontecimiento · {event.title}</strong>
                  </button>
                ))}
            </div>
          ) : (
            <div className="calendar-grid">
              {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((day) => (
                <span className="weekday" key={day}>
                  {day}
                </span>
              ))}
              {Array.from({ length: offset }, (_, index) => (
                <span key={`empty-${index}`} />
              ))}
              {Array.from({ length: days }, (_, index) => {
                const date = dateKey(index + 1);
                const hasEntry = datesWithRecords.has(date);
                return (
                  <button
                    key={date}
                    aria-label={`${formatDate(date)}${
                      hasEntry ? ", con registros" : ", sin registros"
                    }`}
                    aria-pressed={selected === date}
                    className={`${selected === date ? "selected" : ""} ${
                      date === today() ? "is-today" : ""
                    }`}
                    onClick={() => setSelected(date)}
                  >
                    <span>{index + 1}</span>
                    {hasEntry && <small>●</small>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="calendar-legend">
            <span>● Con entradas, registros o acontecimientos</span>
            <span>Contorno: hoy</span>
            <span>Salvia: día seleccionado</span>
          </div>
        </section>
        <aside className="selected-day">
          <p className="eyebrow">UNA FECHA, UN MOMENTO</p>
          <h2>{formatDate(selected)}</h2>
          {selectedEvents.map((event) => (
            <Link className="day-entry" key={event.id} to="/linea-temporal">
              <h3>{event.title}</h3>
              <p>
                Acontecimiento{" "}
                {event.journalEntryReference ? "relacionado con el diario" : "independiente"}
              </p>
              <span>Ver en la línea temporal</span>
            </Link>
          ))}
          {selectedCheckin && (
            <Link className="day-entry" to={`/registro?fecha=${selected}`}>
              <h3>Registro breve del día</h3>
              <p>
                {selectedCheckin.mood?.moodValue || "Sin ánimo registrado"} ·{" "}
                {selectedCheckin.energy
                  ? `Energía ${selectedCheckin.energy.energyValue}/5`
                  : "Sin energía registrada"}
              </p>
              <span>Ver o editar registro</span>
            </Link>
          )}
          {selectedRecords.length
            ? selectedRecords.map((entry) => (
                <Link className="day-entry" key={entry.id} to={`/diario/${entry.id}`}>
                  <h3>{entry.title || "Sin título"}</h3>
                  <p>{entry.content}</p>
                  <span>
                    Leer entrada <ArrowUpRight size={14} />
                  </span>
                </Link>
              ))
            : !selectedCheckin &&
              !selectedEvents.length && (
                <EmptyState title="Un espacio en blanco">
                  No hay entradas para esta fecha. Puedes dejarla así, o escribir unas palabras.
                </EmptyState>
              )}
          <Link to={`/diario/nueva?fecha=${selected}`} className="button secondary">
            Escribir una entrada
          </Link>
        </aside>
      </div>
    </>
  );
}

export { default as Timeline } from "./timeline/Timeline";

export function Memories() {
  const { entries, lifeEvents } = useSession();
  const [example, setExample] = useState(false);
  const [list, setList] = useState(false);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState<JournalEntry | null>(null);
  const source = example ? examples : entries.filter((entry) => entry.mediaReferences.length);
  const records = source.filter(
    (entry) =>
      `${entry.title} ${entry.content} ${entry.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (tag === "all" || entry.tags.includes(tag)) &&
      (!date || entry.entryDate.startsWith(date)),
  );
  return (
    <>
      <PageHeader
        eyebrow="LO QUE QUIERES CONSERVAR"
        title="El archivo de tus recuerdos"
        description="Instantes a los que puedes volver, una y otra vez."
      />
      <div className="filter-bar">
        <div className="tabs">
          <button className={!example ? "active" : ""} onClick={() => setExample(false)}>
            Mis recuerdos
          </button>
          <button className={example ? "active" : ""} onClick={() => setExample(true)}>
            Galería de ejemplo
          </button>
        </div>
        <div className="view-controls">
          <button
            className="icon-button"
            aria-label="Galería"
            aria-pressed={!list}
            onClick={() => setList(false)}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Lista"
            aria-pressed={list}
            onClick={() => setList(true)}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <input
          aria-label="Buscar recuerdos"
          placeholder="Buscar un momento, una palabra…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input
          type="month"
          aria-label="Filtrar por mes"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <select aria-label="Etiqueta" value={tag} onChange={(event) => setTag(event.target.value)}>
          <option value="all">Todas las etiquetas</option>
          {[
            ...new Set([
              ...source.flatMap((entry) => entry.tags),
              ...(!example ? lifeEvents.flatMap((event) => event.tags) : []),
            ]),
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      {example && (
        <Notice>
          Archivo ilustrativo. Fotografías de Unsplash incluidas en la aplicación; no son archivos
          tuyos.
        </Notice>
      )}
      {!example ? (
        <LocalMemories list={list} search={search} tag={tag} date={date} />
      ) : records.length ? (
        <div className={list ? "memory-list" : "archive-grid"}>
          {records.map((entry) => (
            <button className="archive-item" key={entry.id} onClick={() => setDetail(entry)}>
              {entry.mediaReferences[0] ? (
                <img src={entry.mediaReferences[0]} alt={entry.title} />
              ) : (
                <div className="archive-text">“{entry.content.slice(0, 100)}…”</div>
              )}
              <div>
                <span className="eyebrow">{formatDate(entry.entryDate)}</span>
                <h3>{entry.title}</h3>
                <span className="muted small">
                  {entry.mediaReferences.length ? "Fotografía de ejemplo" : "Fragmento de diario"}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Aquí vivirán tus recuerdos">
          No hay ejemplos que coincidan con estos filtros.
        </EmptyState>
      )}
      {detail && (
        <Dialog title={detail.title || "Recuerdo"} onClose={() => setDetail(null)}>
          {detail.mediaReferences[0] && (
            <img className="detail-photo" src={detail.mediaReferences[0]} alt={detail.title} />
          )}
          <p className="eyebrow">{formatDate(detail.entryDate)}</p>
          <p>{detail.content}</p>
          <p className="small muted">
            {detail.example
              ? "Fotografía ilustrativa local · no es un archivo personal."
              : "Registro guardado en el dispositivo."}
          </p>
          <Link
            to={`/diario/${detail.id}`}
            className="button primary"
            onClick={() => setDetail(null)}
          >
            Ver la entrada relacionada <ArrowUpRight size={16} />
          </Link>
        </Dialog>
      )}
    </>
  );
}
