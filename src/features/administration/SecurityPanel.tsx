import { useState } from "react";
import { auth } from "../../application/auth";
import { errorMessage } from "../../application/errors";
import { Notice } from "../../components/ui";

export default function SecurityPanel({
  minutes,
  onUpdate,
}: {
  minutes: number;
  onUpdate: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="admin-panel">
      <p className="eyebrow">SEGURIDAD Y ACCESO</p>
      <h2>Un umbral para tu sistema</h2>
      <p>
        El acceso administrativo se pierde al recargar o cerrar esta pestaña, tras un máximo de 8
        horas o por inactividad. No bloquea la lectura del diario ni cifra la base.
      </p>
      <label>
        Bloqueo automático por inactividad
        <select
          value={minutes}
          onChange={async (event) => {
            try {
              await auth.setTimeout(Number(event.target.value));
              setMessage("Bloqueo automático actualizado.");
              onUpdate();
            } catch (error) {
              setMessage(errorMessage(error));
            }
          }}
        >
          {Array.from({ length: 60 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value} minutos
            </option>
          ))}
        </select>
      </label>
      <form
        className="stack-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (next !== repeat) {
            setMessage("Las contraseñas nuevas no coinciden.");
            return;
          }
          setBusy(true);
          try {
            await auth.changePassword(current, next);
            setCurrent("");
            setNext("");
            setRepeat("");
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Cambiar contraseña</h3>
        <label>
          Contraseña actual
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <label>
          Nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={200}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </label>
        <label>
          Repite la nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {busy ? "Actualizando…" : "Cambiar contraseña y cerrar sesión"}
        </button>
      </form>
      {message && <Notice>{message}</Notice>}
      <p className="muted small">
        No hay recuperación por correo ni contraseña predeterminada. Un respaldo puede importarse en
        otro perfil con un nuevo propietario local. Los límites de intentos son una barrera de
        cortesía, no una defensa contra alguien con control del dispositivo.
      </p>
    </section>
  );
}
