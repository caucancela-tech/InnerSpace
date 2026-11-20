import { mediaSchema, type StoredMedia } from "../domain/validation";
import { invariant } from "./errors";
import { db, type InnerSpaceDatabase } from "../infrastructure/database";

export const acceptedMedia =
  "image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4";
export async function prepareMedia(file: File): Promise<{ asset: StoredMedia; blob: Blob }> {
  invariant(
    file.size > 0 && file.size <= 25 * 1024 * 1024,
    "Cada archivo debe ocupar entre 1 byte y 25 MB.",
  );
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const matches: Record<string, boolean> = {
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/png": bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10",
    "image/webp": text.startsWith("RIFF") && text.slice(8, 12) === "WEBP",
    "audio/wav": text.startsWith("RIFF") && text.slice(8, 12) === "WAVE",
    "audio/ogg": text.startsWith("OggS"),
    "audio/webm": bytes.slice(0, 4).join(",") === "26,69,223,163",
    "audio/mp4": text.slice(4, 8) === "ftyp",
    "audio/mpeg": text.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
  };
  invariant(
    matches[file.type],
    "Archivo inválido o tipo no admitido. Usa JPEG, PNG, WebP, MP3, WAV, OGG, WebM o M4A; no se aceptan SVG ni ejecutables.",
  );
  const now = new Date().toISOString();
  return {
    asset: mediaSchema.parse({
      id: crypto.randomUUID(),
      mediaType: file.type.startsWith("image/") ? "photo" : "audio",
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: now,
      updatedAt: now,
    }),
    blob: file,
  };
}
export class MediaService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async blob(id: string) {
    return (await this.database.mediaBlobs.get(id))?.blob;
  }
  /** Removes references and binary together, including references shared by events. */
  async remove(id: string) {
    await this.database.transaction(
      "rw",
      [
        this.database.mediaAssets,
        this.database.mediaBlobs,
        this.database.journalEntries,
        this.database.lifeEvents,
      ],
      async () => {
        const now = new Date().toISOString();
        await this.database.journalEntries.toCollection().modify((entry) => {
          if (!entry.mediaReferences.includes(id)) return false;
          entry.mediaReferences = entry.mediaReferences.filter((ref) => ref !== id);
          entry.updatedAt = now;
        });
        await this.database.lifeEvents.toCollection().modify((event) => {
          if (!event.mediaReferences.includes(id)) return false;
          event.mediaReferences = event.mediaReferences.filter((ref) => ref !== id);
          event.updatedAt = now;
        });
        await this.database.mediaAssets.delete(id);
        await this.database.mediaBlobs.delete(id);
      },
    );
  }
}
export const mediaService = new MediaService();
