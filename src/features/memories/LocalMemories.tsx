import { useState } from "react";
import { Link } from "react-router";
import { Music } from "lucide-react";
import { useSession } from "../../app/store";
import { mediaService } from "../../application/media";
import { errorMessage } from "../../application/errors";
import { Dialog, EmptyState, Notice } from "../../components/ui";
import MediaPreview from "../../components/MediaPreview";

export default function LocalMemories({
  list,
  search,
  tag,
  date,
}: {
  list: boolean;
  search: string;
  tag: string;
  date: string;
}) {
  const { mediaAssets, entries, lifeEvents } = useSession();
  const [detailId, setDetailId] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const references = (id: string) => [
    ...entries
      .filter((entry) => entry.mediaReferences.includes(id))
      .map((entry) => ({
        id: entry.id,
        title: entry.title || "Sin título",
        date: entry.entryDate,
        tags: entry.tags,
        path: `/diario/${entry.id}`,
      })),
    ...lifeEvents
      .filter((event) => event.mediaReferences.includes(id))
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.eventDate,
        tags: event.tags,
        path: "/linea-temporal",
      })),
  ];
  const records = mediaAssets.filter((asset) => {
    const refs = references(asset.id);
    return (
      `${asset.filename} ${refs.map((ref) => ref.title).join(" ")}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")) &&
      (tag === "all" || refs.some((ref) => ref.tags.includes(tag))) &&
      (!date || refs.some((ref) => ref.date.startsWith(date)) || asset.createdAt.startsWith(date))
    );
  });
  const detail = mediaAssets.find((asset) => asset.id === detailId);
  return (
    <>
      {records.length ? (
        <div className={list ? "memory-list" : "archive-grid"}>
          {records.map((asset) => (
            <button
              key={asset.id}
              className="archive-item"
              onClick={() => {
                setDetailId(asset.id);
                setError("");
              }}
            >
              {asset.mediaType === "photo" ? (
                <MediaPreview id={asset.id} />
              ) : (
                <div className="archive-text">
                  <Music size={28} />
                  <span>Grabación</span>
                </div>
              )}
              <div>
                <span className="eyebrow">
                  {new Date(asset.createdAt).toLocaleDateString("es")}
                </span>
                <h3>{asset.filename}</h3>
                <span className="muted small">
                  {(asset.size / 1024).toFixed(1)} KB · {references(asset.id).length} referencias
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Aquí vivirán tus recuerdos">
          Adjunta fotografías o grabaciones desde el editor. No se incluyen archivos de ejemplo en
          tu biblioteca.
        </EmptyState>
      )}
      {detail && (
        <Dialog
          title={detail.filename}
          onClose={() => {
            if (!busy) {
              setDetailId(undefined);
              setDeleting(false);
            }
          }}
        >
          <MediaPreview id={detail.id} className="detail-photo" />
          <p>
            {detail.mimeType} · {(detail.size / 1024).toFixed(1)} KB
          </p>
          <h3>Referencias reales</h3>
          {references(detail.id).length ? (
            references(detail.id).map((ref) => (
              <Link key={ref.id} className="day-entry" to={ref.path}>
                {ref.title} · {ref.date}
              </Link>
            ))
          ) : (
            <Notice>
              Archivo independiente, sin referencias actuales. Se conserva hasta que decidas
              eliminarlo.
            </Notice>
          )}
          {error && <Notice error>{error}</Notice>}
          {deleting ? (
            <>
              <Notice error>
                Eliminar retirará este archivo de todas sus entradas y acontecimientos y borrará el
                binario. No puede deshacerse sin un respaldo.
              </Notice>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await mediaService.remove(detail.id);
                    setDetailId(undefined);
                    setDeleting(false);
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Eliminar archivo definitivamente
              </button>
              <button className="text-button" onClick={() => setDeleting(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button className="button secondary" onClick={() => setDeleting(true)}>
              Eliminar archivo
            </button>
          )}
        </Dialog>
      )}
    </>
  );
}
