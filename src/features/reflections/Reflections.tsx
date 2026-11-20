import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useSession } from "../../app/store";
import { today, formatDate, type Reflection } from "../../domain/models";
import { PageHeader, Notice, EmptyState } from "../../components/ui";
import { errorMessage } from "../../application/errors";

const initialQuestions = [
  "¿Qué momento de esta semana quiero recordar?",
  "¿Qué aprendí sobre mí?",
  "¿Qué me aportó tranquilidad?",
  "¿Qué me gustaría comprender mejor?",
  "¿Qué quiero llevar conmigo a la próxima semana?",
];
export default function Reflections() {
  const { entries, reflections, saveReflection } = useSession();
  const [questions, setQuestions] = useState(initialQuestions);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [start, setStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toLocaleDateString("sv");
  });
  const [end, setEnd] = useState(today());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reflectionId, setReflectionId] = useState<string | undefined>();
  const periodEntries = entries.filter(
    (entry) => entry.entryDate >= start && entry.entryDate <= end,
  );
  return (
    <>
      <PageHeader
        eyebrow="MIRAR ATRÁS, CON CALMA"
        title="Lo que te llevas contigo"
        description="Una semana no necesita un balance. A veces, solo una mirada amable."
      />
      <div className="reflection-layout">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            if (
              questions.some((question) => !question.trim()) ||
              new Set(questions).size !== questions.length
            ) {
              setError(
                "Las preguntas no pueden estar vacías ni repetidas. Tus respuestas siguen aquí.",
              );
              return;
            }
            if (!start || !end || start > end) {
              setError("Elige un periodo válido: el inicio debe ser anterior o igual al final.");
              return;
            }
            if (!Object.values(responses).some((response) => response.trim())) {
              setError("Responde al menos una pregunta para guardar tu reflexión.");
              return;
            }
            const now = new Date().toISOString();
            const id = reflectionId || crypto.randomUUID();
            const reflection: Reflection = {
              id,
              periodStart: start,
              periodEnd: end,
              responses: Object.fromEntries(
                questions.map((question, index) => [question, responses[String(index)] || ""]),
              ),
              createdAt: reflections.find((item) => item.id === id)?.createdAt || now,
              updatedAt: now,
            };
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await saveReflection(reflection);
              setReflectionId(id);
              setMessage("Reflexión parcial guardada en el dispositivo.");
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="period-inputs">
            <label>
              Desde
              <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
            </label>
          </div>
          <button type="button" className="text-button" onClick={() => setEditing(!editing)}>
            {editing ? "Terminar de editar preguntas" : "Personalizar mis preguntas"}
          </button>
          {questions.map((question, index) => (
            <div className="reflection-question" key={index}>
              <span>0{index + 1}</span>
              <div>
                {editing ? (
                  <input
                    aria-label={`Pregunta ${index + 1}`}
                    value={question}
                    onChange={(event) => {
                      const updated = [...questions];
                      const text = event.target.value;
                      updated[index] = text;
                      setQuestions(updated);
                    }}
                  />
                ) : (
                  <label htmlFor={`response-${index}`}>{question}</label>
                )}
                <textarea
                  id={`response-${index}`}
                  aria-label={question}
                  placeholder="Lo que venga a tu mente…"
                  value={responses[String(index)] || ""}
                  onChange={(event) =>
                    setResponses({
                      ...responses,
                      [String(index)]: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          ))}
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar reflexión"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setReflectionId(undefined);
              setResponses({});
              setQuestions(initialQuestions);
              setMessage("");
              setError("");
            }}
          >
            Nueva reflexión
          </button>
        </form>
        <aside className="reflection-sidebar">
          <h3>Las páginas de este periodo</h3>
          <p className="muted small">Solo tus registros, no los ejemplos.</p>
          {periodEntries.length ? (
            periodEntries.map((entry) => (
              <Link key={entry.id} className="day-entry" to={`/diario/${entry.id}`}>
                <span>{formatDate(entry.entryDate)}</span>
                <h3>{entry.title || "Sin título"}</h3>
              </Link>
            ))
          ) : (
            <EmptyState title="Sin entradas en este periodo">
              Puedes reflexionar aunque no hayas escrito en tu diario.
            </EmptyState>
          )}
          <h3>Tus reflexiones guardadas</h3>
          {reflections.length ? (
            reflections.map((reflection) => (
              <button
                key={reflection.id}
                className="reflection-saved"
                onClick={() => {
                  setStart(reflection.periodStart);
                  setEnd(reflection.periodEnd);
                  setResponses(
                    Object.fromEntries(
                      Object.values(reflection.responses).map((value, index) => [
                        String(index),
                        value,
                      ]),
                    ),
                  );
                  setQuestions(Object.keys(reflection.responses));
                  setReflectionId(reflection.id);
                  setMessage("Reflexión guardada abierta para editar.");
                }}
              >
                {formatDate(reflection.periodStart)} — {formatDate(reflection.periodEnd)}
                <ArrowRight size={15} />
              </button>
            ))
          ) : (
            <p className="muted small">Todavía no has guardado ninguna.</p>
          )}
        </aside>
      </div>
    </>
  );
}
