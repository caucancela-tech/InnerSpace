import { useEffect, useState } from "react";
import { mediaService } from "../application/media";
import { useSession } from "../app/store";

export default function MediaPreview({
  id,
  className = "",
  previewOnly = false,
}: {
  id: string;
  className?: string;
  previewOnly?: boolean;
}) {
  const { mediaAssets } = useSession();
  const asset = mediaAssets.find((item) => item.id === id);
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setUrl("");
    setError(false);
    mediaService
      .blob(id)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!asset || error)
    return (
      <span role="status">Archivo no disponible. Revisa la integridad en Administración.</span>
    );
  if (previewOnly && asset.mediaType === "audio")
    return <div className="text-memory">Grabación · {asset.filename}</div>;
  if (!url) return <span role="status">Cargando archivo…</span>;
  return asset.mediaType === "photo" ? (
    <img
      className={className}
      src={url}
      alt={asset.filename}
      loading="lazy"
      onError={() => setError(true)}
    />
  ) : (
    <audio
      className={className}
      controls
      preload="metadata"
      src={url}
      aria-label={asset.filename}
    />
  );
}
