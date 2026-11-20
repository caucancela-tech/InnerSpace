export { default as Checkin } from "./checkin/Checkin";
export { default as Reflections } from "./reflections/Reflections";
export { default as Preferences } from "./preferences/Preferences";
import { Link } from "react-router";
import { EmptyState } from "../components/ui";
export function NotFound() {
  return (
    <EmptyState title="Esta página no está aquí">
      <Link className="button primary" to="/">
        Volver a mi espacio
      </Link>
    </EmptyState>
  );
}
