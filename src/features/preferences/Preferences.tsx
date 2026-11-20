import { Link } from "react-router";
import { Sun, Moon, Monitor, ShieldCheck } from "lucide-react";
import { useSession } from "../../app/store";
import { PageHeader } from "../../components/ui";
import { privacyDisclosure } from "../../application/privacy";
import ActivityManager from "../activities/ActivityManager";

export default function Preferences() {
  const { preferences, setPreferences } = useSession();
  return (
    <>
      <PageHeader
        eyebrow="A TU MANERA"
        title="Tu espacio, tus decisiones"
        description="Claridad sobre tus datos. Libertad para elegir cómo habitar este lugar."
      />
      <div className="settings-layout">
        <section className="settings-panel">
          <h2>Apariencia</h2>
          <p className="muted">Elige la luz en la que quieres escribir.</p>
          <div className="theme-options">
            {(
              [
                { value: "light", label: "Claro", icon: Sun },
                { value: "dark", label: "Oscuro", icon: Moon },
                { value: "auto", label: "Automático", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                aria-pressed={preferences.theme === value}
                className={preferences.theme === value ? "selected" : ""}
                onClick={() => setPreferences({ theme: value })}
              >
                <Icon size={24} strokeWidth={1.3} />
                {label}
              </button>
            ))}
          </div>
          <h2>Lectura y accesibilidad</h2>
          <label className="toggle-row">
            <span>
              Texto más grande<small>Amplía el texto de lectura y los controles.</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.accessibilityPreferences.largeText}
              onChange={(event) =>
                setPreferences({
                  accessibilityPreferences: {
                    largeText: event.target.checked,
                  },
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>
              Reducir movimiento<small>También se respeta la preferencia de tu dispositivo.</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.accessibilityPreferences.reducedMotion}
              onChange={(event) =>
                setPreferences({
                  accessibilityPreferences: {
                    reducedMotion: event.target.checked,
                  },
                })
              }
            />
          </label>
          <h2>Preferencias de escritura</h2>
          <label>
            Idioma
            <select disabled>
              <option>Español · otros idiomas pendientes</option>
            </select>
          </label>
          <label>
            Formato de fecha
            <select disabled>
              <option>Día, mes y año</option>
            </select>
          </label>
          <ActivityManager />
        </section>
        <section className="settings-panel privacy-panel">
          <ShieldCheck size={27} strokeWidth={1.3} />
          <h2>Privacidad sin letra pequeña</h2>
          <p>{privacyDisclosure}</p>
          <ul>
            <li>No hay backend, sincronización, telemetría ni IA operativa.</li>
            <li>
              Fuentes y fotografías ilustrativas se sirven con la aplicación; los ejemplos nunca se
              guardan como registros personales.
            </li>
            <li>
              Tus fotografías y grabaciones se almacenan como binarios independientes. No se suben a
              servidores.
            </li>
            <li>
              La contraseña protege las operaciones administrativas, no cifra ni bloquea la lectura
              del diario.
            </li>
            <li>
              En la versión de producción, la primera carga necesita conexión para instalar la caché
              offline. Después funciona en este mismo origen sin internet.
            </li>
          </ul>
          <h3>Tus datos, contigo</h3>
          <p>
            Los respaldos completos incluyen registros y archivos, pero no contraseñas. Descárgalos
            y consérvalos fuera del navegador.
          </p>
          <Link className="button primary" to="/administracion">
            Administración y respaldos
          </Link>
          <div className="future-capability">
            <span className="chip">INTEGRACIONES DESACTIVADAS</span>
            <h3>Crecer, sin invadir</h3>
            <p>
              Sincronización e IA son contratos futuros, sin proveedor conectado. Cualquier
              integración requerirá autorización explícita y no modificará tus entradas originales.
            </p>
          </div>
          <h3>InnerSpace · local-first 2.0</h3>
          <div className="chips">
            <Link className="chip" to="/linea-temporal">
              Línea temporal
            </Link>
            <Link className="chip" to="/reflexiones">
              Reflexiones
            </Link>
            <Link className="chip" to="/registro">
              Registro breve
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
