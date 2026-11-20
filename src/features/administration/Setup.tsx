import { useState } from "react";
import { Leaf, ShieldCheck } from "lucide-react";
import { auth } from "../../application/auth";
import { errorMessage } from "../../application/errors";
import { privacyDisclosure } from "../../application/privacy";

export default function Setup() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="app setup-screen">
      <section className="setup-card">
        <span className="brand">
          <Leaf size={27} /> innerspace.
        </span>
        <p className="eyebrow">UN ESPACIO SOLO TUYO</p>
        <h1>Tu historia empieza aquí.</h1>
        <p>
          Configura al propietario de este dispositivo. No se crea ninguna cuenta remota ni se
          envían tus datos.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            if (password !== repeat) {
              setError("Las contraseñas no coinciden.");
              return;
            }
            setBusy(true);
            try {
              await auth.setup(name, password);
              setPassword("");
              setRepeat("");
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tu nombre
            <input
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Contraseña administrativa
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Repite la contraseña
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            />
          </label>
          <p className="muted small">
            Al menos 12 caracteres. No hay recuperación por correo. Conserva tu contraseña y tus
            respaldos en un lugar seguro.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Configurando el espacio…" : "Crear mi espacio local"}
          </button>
        </form>
        <div className="privacy-disclosure">
          <ShieldCheck size={21} />
          <p>
            {privacyDisclosure} El diario personal no se bloquea con esta contraseña; se protege el
            panel administrativo.
          </p>
        </div>
      </section>
    </div>
  );
}
