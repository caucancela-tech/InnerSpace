import { ZodError } from "zod";

export function errorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return `Datos no válidos: ${error.issues[0]?.message || "revisa los campos"}.`;
  const name = error instanceof Error ? error.name : "";
  if (name.includes("Quota"))
    return "No queda espacio en el navegador. Conserva el texto, libera espacio o descarga un respaldo e inténtalo de nuevo.";
  if (
    [
      "OpenFailedError",
      "SecurityError",
      "InvalidStateError",
      "DatabaseClosedError",
      "MissingAPIError",
      "VersionError",
    ].includes(name)
  )
    return "La base local no está disponible. No borres los datos del navegador. Cierra otras pestañas y vuelve a intentarlo; usa tu respaldo en otro perfil si es necesario.";
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación. Tus cambios en pantalla se conservan; vuelve a intentarlo.";
}
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
