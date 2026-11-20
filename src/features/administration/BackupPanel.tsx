import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { backupService, type PreparedBackup } from "../../application/backup";
import { errorMessage } from "../../application/errors";
import { today } from "../../domain/models";
import { Dialog, Notice } from "../../components/ui";

export default function BackupPanel({ onUpdate }: { onUpdate: () => void }) {
  const [prepared, setPrepared] = useState<PreparedBackup>();
  const [confirmation, setConfirmation] = useState("");
  const [protectedCopy, setProtectedCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const download = async () => {
    setBusy(true);
    setError("");
    setMessage("Preparando respaldo completo…");
    try {
      let warning = "";
      const blob = await backupService.export((message) => {
        warning = message;
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `innerspace-completo-${today()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage(
        warning ||
          "Respaldo generado con datos y archivos. Comprueba que la descarga finalizó y consérvala fuera del dispositivo; la aplicación no puede confirmar su conservación.",
      );
      onUpdate();
    } catch (error) {
      setError(errorMessage(error));
      setMessage("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-panel">
      <p className="eyebrow">CONSERVAR Y RECUPERAR</p>
      <h2>Tu historia, a salvo contigo</h2>
      <p>
        ZIP versionado con diario, ánimo, energía, actividades, acontecimientos, reflexiones,
        etiquetas, preferencias y todos los binarios. No incluye contraseña ni sesión
        administrativa. No está cifrado.
      </p>
      <div className="dialog-actions">
        <button className="button secondary" disabled={busy} onClick={() => void download()}>
          <Download size={17} />
          Descargar respaldo completo
        </button>
        <button className="button secondary" disabled={busy} onClick={() => file.current?.click()}>
          <Upload size={17} />
          Importar respaldo
        </button>
      </div>
      <input
        hidden
        ref={file}
        type="file"
        accept=".zip,application/zip"
        aria-label="Seleccionar respaldo ZIP"
        onChange={async (event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          setBusy(true);
          setError("");
          setMessage("Validando formato, referencias y archivos…");
          try {
            setPrepared(await backupService.inspect(selected));
            setConfirmation("");
            setProtectedCopy(false);
            setMessage("Validación completada. Aún no se ha modificado nada.");
          } catch (error) {
            setError(errorMessage(error));
            setMessage(
              "No se cambió tu base. Prueba un respaldo anterior o conserva el ZIP para recuperarlo con una versión compatible.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {prepared && (
        <Dialog
          title="Restaurar un respaldo validado"
          onClose={() => {
            if (!busy) setPrepared(undefined);
          }}
        >
          <p>
            Respaldo del {new Date(prepared.createdAt).toLocaleString("es")}. Incluye{" "}
            {prepared.counts.journalEntries} entradas y {prepared.counts.mediaAssets} archivos.
          </p>
          <Notice error>
            La restauración reemplaza TODOS los datos personales y preferencias actuales. No combina
            registros. Se conservarán el propietario, sus credenciales y el historial
            administrativo. Se cerrará la sesión administrativa.
          </Notice>
          <button className="button secondary" disabled={busy} onClick={() => void download()}>
            Descargar primero mis datos actuales
          </button>
          <label className="toggle-row">
            <span>He conservado una copia de mis datos actuales o acepto perderlos.</span>
            <input
              type="checkbox"
              checked={protectedCopy}
              onChange={(event) => setProtectedCopy(event.target.checked)}
            />
          </label>
          <label>
            Escribe RESTAURAR para confirmar
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          {error && <Notice error>{error}</Notice>}
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPrepared(undefined)}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy || !protectedCopy || confirmation !== "RESTAURAR"}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("Restauración en progreso. No cierres esta pestaña.");
                try {
                  await backupService.restore(prepared, confirmation);
                  setPrepared(undefined);
                  onUpdate();
                  window.dispatchEvent(new Event("innerspace-restored"));
                } catch (error) {
                  setError(errorMessage(error));
                  setMessage(
                    "Restauración cancelada; la transacción conserva tus datos anteriores. Libera espacio o usa otro perfil y vuelve a importar el ZIP.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Restaurando…" : "Reemplazar y restaurar"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
