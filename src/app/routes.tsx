import { createBrowserRouter, NavLink, Outlet, Link, useLocation, useParams } from "react-router";
import {
  BookOpen,
  CalendarDays,
  House,
  Layers,
  Leaf,
  Settings,
  Sparkles,
  Images,
  Plus,
  Sun,
  Moon,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { lazy, Suspense, useRef } from "react";
import { SessionProvider, useSession } from "./store";
import { Notice } from "../components/ui";
const Home = lazy(() => import("../features/home"));
const Journal = lazy(() =>
  import("../features/journal").then((module) => ({ default: module.Journal })),
);
const Editor = lazy(() =>
  import("../features/journal").then((module) => ({ default: module.Editor })),
);
const Calendar = lazy(() =>
  import("../features/explore").then((module) => ({ default: module.Calendar })),
);
const Memories = lazy(() =>
  import("../features/explore").then((module) => ({ default: module.Memories })),
);
const Timeline = lazy(() => import("../features/timeline/Timeline"));
const Checkin = lazy(() => import("../features/checkin/Checkin"));
const Reflections = lazy(() => import("../features/reflections/Reflections"));
const Preferences = lazy(() => import("../features/preferences/Preferences"));
const Administration = lazy(() => import("../features/administration/Administration"));
const NotFound = lazy(() =>
  import("../features/personal").then((module) => ({ default: module.NotFound })),
);

const navigation = [
  { path: "/", label: "Inicio", icon: House },
  { path: "/diario", label: "Mi diario", icon: BookOpen },
  { path: "/calendario", label: "Calendario", icon: CalendarDays },
  { path: "/linea-temporal", label: "Línea temporal", icon: Layers },
  { path: "/reflexiones", label: "Reflexiones", icon: Sparkles },
  { path: "/recuerdos", label: "Recuerdos", icon: Images },
];
function Shell() {
  const { preferences, setPreferences, operation, storageError } = useSession();
  return (
    <div
      className={`app ${
        preferences.theme === "dark" ? "dark" : preferences.theme === "auto" ? "auto-theme" : ""
      } ${preferences.accessibilityPreferences.largeText ? "large-text" : ""} ${
        preferences.accessibilityPreferences.reducedMotion ? "reduce-motion" : ""
      }`}
    >
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-symbol">
            <Leaf size={24} strokeWidth={1.3} />
          </span>
          innerspace<span className="brand-dot">.</span>
        </Link>
        <p className="brand-caption">UN LUGAR PARA VOLVER A TI</p>
        <Link to="/diario/nueva" className="button primary sidebar-write">
          <Plus size={17} />
          Escribir en mi diario
        </Link>
        <nav aria-label="Navegación principal">
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <Icon size={19} strokeWidth={1.6} />
              {label}
              {path === "/" && <span className="nav-marker" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={21} strokeWidth={1.2} />
            <p>
              No hay una forma correcta
              <br />
              de contar tu historia.
            </p>
            <span>Este espacio es tuyo.</span>
          </div>
          <NavLink to="/configuracion" className="nav-link">
            <Settings size={19} strokeWidth={1.5} />
            Configuración
          </NavLink>
          <NavLink to="/administracion" className="nav-link">
            <ShieldCheck size={19} />
            Administración
          </NavLink>
          <div className="profile">
            <span className="avatar">Tú</span>
            <div>
              <strong>Tu espacio personal</strong>
              <span>Local · en este dispositivo</span>
            </div>
            <Link to="/configuracion" aria-label="Preferencias personales">
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <div className="topbar">
          <span>
            <span className="status-dot" /> Tu historia, a tu ritmo
          </span>
          <div>
            <Link to="/configuracion" className="session-label">
              Sin conexiones externas de datos
            </Link>
            <button
              className="icon-button"
              aria-label={
                preferences.theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"
              }
              onClick={() =>
                setPreferences({
                  theme: preferences.theme === "dark" ? "light" : "dark",
                })
              }
            >
              {preferences.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        <main id="contenido">
          {storageError && <Notice error>{storageError}</Notice>}
          <span className="storage-status" role="status">
            {operation === "saving"
              ? "Guardando en el dispositivo…"
              : operation === "saved"
                ? "Último cambio guardado en el dispositivo"
                : ""}
          </span>
          <Suspense fallback={<p role="status">Abriendo esta página…</p>}>
            <Outlet />
          </Suspense>
        </main>
        <footer>
          Un pequeño espacio para tu mundo interior.
          <span>InnerSpace · Local-first</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.slice(0, 3).map(({ path, label, icon: Icon }) => (
          <NavLink end={path === "/"} key={path} to={path}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/recuerdos">
          <Images size={21} />
          <span>Recuerdos</span>
        </NavLink>
        <NavLink to="/configuracion">
          <Settings size={21} />
          <span>Más</span>
        </NavLink>
      </nav>
    </div>
  );
}
function Root() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
function EditorRoute() {
  const location = useLocation();
  const { id } = useParams();
  const { entries } = useSession();
  const seen = useRef(new Set<string>());
  if (id && entries.some((entry) => entry.id === id)) seen.current.add(id);
  // A write can finish just before liveQuery publishes the committed snapshot.
  // Remount on availability, never on another tab's edits while the user writes.
  const available = !!id && seen.current.has(id);
  return <Editor key={`${location.pathname}${location.search}-${available}`} />;
}
export const router = createBrowserRouter([
  {
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "diario", Component: Journal },
      { path: "diario/nueva", Component: EditorRoute },
      { path: "diario/:id", Component: EditorRoute },
      { path: "calendario", Component: Calendar },
      { path: "linea-temporal", Component: Timeline },
      { path: "reflexiones", Component: Reflections },
      { path: "recuerdos", Component: Memories },
      { path: "configuracion", Component: Preferences },
      { path: "registro", Component: Checkin },
      { path: "administracion", Component: Administration },
      { path: "*", Component: NotFound },
    ],
  },
]);
