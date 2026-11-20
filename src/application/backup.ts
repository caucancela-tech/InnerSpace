import { unzipSync, zip, strFromU8, strToU8 } from "fflate";
import { z } from "zod";
import {
  db,
  personalTableNames,
  SCHEMA_VERSION,
  type InnerSpaceDatabase,
} from "../infrastructure/database";
import { dataSchemas } from "../domain/validation";
import { invariant } from "./errors";
import { checkIntegrity, readPersonalData, type PersonalData } from "./integrity";
import { auth, type AuthService } from "./auth";
import { prepareMedia } from "./media";

const VERSION = 1;
const MAX_ARCHIVE = 200 * 1024 * 1024;
const MAX_EXPANDED = 500 * 1024 * 1024;
const manifestSchema = z
  .object({
    format: z.literal("innerspace-complete"),
    version: z.literal(VERSION),
    schemaVersion: z.literal(SCHEMA_VERSION),
    createdAt: z.string().datetime(),
    data: z
      .object(
        Object.fromEntries(
          Object.entries(dataSchemas).map(([name, schema]) => [name, z.array(schema).max(100_000)]),
        ),
      )
      .strict(),
    files: z
      .array(
        z
          .object({
            id: z.string(),
            path: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict();
async function digest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
function compress(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 1 }, (error, bytes) => (error ? reject(error) : resolve(bytes))),
  );
}
export interface PreparedBackup {
  data: PersonalData;
  createdAt: string;
  counts: Record<string, number>;
}
export class BackupService {
  constructor(
    private database: InnerSpaceDatabase = db,
    private access: AuthService = auth,
  ) {}
  async export(onWarning?: (message: string) => void): Promise<Blob> {
    this.access.assert();
    const data = await readPersonalData(this.database);
    invariant(
      data.mediaAssets.length <= 10_000 &&
        data.mediaAssets.reduce((total, asset) => total + asset.size, 0) <= MAX_EXPANDED,
      "La biblioteca supera los límites de este respaldo local: 10 000 archivos o 500 MB. No se han cargado los binarios ni se ha modificado tu información.",
    );
    invariant(
      !checkIntegrity(data).length,
      "Hay problemas de integridad. Revisa el diagnóstico antes de exportar.",
    );
    const binaries: Record<string, Uint8Array> = {};
    const files = [];
    for (const asset of data.mediaAssets) {
      const blob = data.mediaBlobs.find((row) => row.id === asset.id)!.blob;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const path = `media/${asset.id}`;
      binaries[path] = bytes;
      files.push({ id: asset.id, path, sha256: await digest(bytes) });
    }
    const { mediaBlobs: _blobs, ...records } = data;
    const createdAt = new Date().toISOString();
    const manifest = manifestSchema.parse({
      format: "innerspace-complete",
      version: VERSION,
      schemaVersion: SCHEMA_VERSION,
      createdAt,
      data: records,
      files,
    });
    binaries["manifest.json"] = strToU8(JSON.stringify(manifest));
    invariant(
      binaries["manifest.json"].length <= 50 * 1024 * 1024,
      "Los metadatos superan el límite de respaldo de 50 MB. No se han modificado tus datos.",
    );
    invariant(
      Object.values(binaries).reduce((size, bytes) => size + bytes.length, 0) <= MAX_EXPANDED,
      "El respaldo supera el límite local de 500 MB. No se ha modificado tu información.",
    );
    const bytes = await compress(binaries);
    invariant(
      bytes.length <= MAX_ARCHIVE,
      "El ZIP supera el límite de 200 MB admitido por el restaurador.",
    );
    this.access.assert();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" });
    try {
      await this.database.transaction(
        "rw",
        [this.database.backupMetadata, this.database.auditEvents],
        async () => {
          await this.database.backupMetadata.add({
            id: crypto.randomUUID(),
            createdAt,
            size: blob.size,
            kind: "export",
          });
          await this.access.log(
            "Respaldo completo generado; descarga pendiente de conservación por el usuario",
          );
        },
      );
    } catch {
      // A full database must not prevent downloading an otherwise valid rescue backup.
      onWarning?.(
        "La copia completa se generó, pero no se pudo registrar su fecha en la base. Comprueba la descarga y conserva el ZIP.",
      );
    }
    return blob;
  }
  async inspect(file: Blob): Promise<PreparedBackup> {
    this.access.assert();
    invariant(
      file.size > 0 && file.size <= MAX_ARCHIVE,
      "El respaldo debe ser un ZIP de hasta 200 MB.",
    );
    let expanded = 0;
    let archive: ReturnType<typeof unzipSync>;
    try {
      archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => {
          expanded += entry.originalSize;
          invariant(
            entry.originalSize <= MAX_EXPANDED && expanded <= MAX_EXPANDED,
            "El archivo descomprimido supera el límite seguro de 500 MB.",
          );
          return true;
        },
      });
    } catch (error) {
      if (error instanceof Error && !("code" in error)) throw error;
      throw new Error(
        "El ZIP está dañado o incompleto. No se ha modificado la base; conserva el archivo original y prueba otro respaldo.",
      );
    }
    invariant(
      archive["manifest.json"] && archive["manifest.json"].length <= 50 * 1024 * 1024,
      "Respaldo incompleto: no hay un manifiesto válido.",
    );
    let raw: unknown;
    try {
      raw = JSON.parse(strFromU8(archive["manifest.json"]));
    } catch {
      throw new Error(
        "El manifiesto está dañado. Conserva este ZIP y prueba con un respaldo anterior; no se ha cambiado tu base.",
      );
    }
    const parsed = manifestSchema.safeParse(raw);
    invariant(
      parsed.success,
      "Formato, estructura o versión de respaldo incompatible. No se ha modificado la base; conserva el original y usa una versión compatible.",
    );
    const manifest = parsed.data;
    const data = { ...manifest.data, mediaBlobs: [] } as unknown as PersonalData;
    invariant(
      manifest.files.length === data.mediaAssets.length,
      "El respaldo no contiene todos sus archivos.",
    );
    const seen = new Set<string>();
    for (const asset of data.mediaAssets) {
      const info = manifest.files.find((row) => row.id === asset.id);
      invariant(
        info && info.path === `media/${asset.id}` && !seen.has(info.path),
        "Referencias de archivos inválidas o duplicadas.",
      );
      seen.add(info.path);
      const bytes = archive[info.path];
      invariant(
        bytes && bytes.length === asset.size && (await digest(bytes)) === info.sha256,
        `Archivo ausente, incompleto o alterado: ${asset.filename}.`,
      );
      const blob = new Blob([new Uint8Array(bytes)], { type: asset.mimeType });
      await prepareMedia(new File([blob], asset.filename, { type: asset.mimeType }));
      data.mediaBlobs.push({ id: asset.id, blob });
    }
    invariant(
      Object.keys(archive).length === seen.size + 1,
      "El ZIP contiene archivos no declarados.",
    );
    const problems = checkIntegrity(data);
    invariant(
      !problems.length,
      `Respaldo con relaciones inválidas: ${problems.slice(0, 3).join("; ")}`,
    );
    this.access.assert();
    return {
      data,
      createdAt: manifest.createdAt,
      counts: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length])),
    };
  }
  async restore(prepared: PreparedBackup, confirmation: string) {
    this.access.assert();
    invariant(
      confirmation === "RESTAURAR",
      "Escribe RESTAURAR para confirmar el reemplazo de los datos personales.",
    );
    invariant(
      !checkIntegrity(prepared.data).length,
      "La validación ya no es correcta. Vuelve a seleccionar el respaldo.",
    );
    // All clears and writes are in one transaction. Quota/constraint failures roll everything back.
    await this.database.transaction(
      "rw",
      [
        ...personalTableNames.map((name) => this.database.table(name)),
        this.database.backupMetadata,
        this.database.auditEvents,
      ],
      async () => {
        this.access.assert();
        for (const name of personalTableNames) {
          await this.database.table(name).clear();
          await this.database.table(name).bulkAdd(prepared.data[name]);
        }
        await this.database.backupMetadata.add({
          id: crypto.randomUUID(),
          kind: "restore",
          size: 0,
          createdAt: new Date().toISOString(),
        });
        await this.access.log("Respaldo restaurado atómicamente; credenciales locales conservadas");
      },
    );
    // The transaction has committed. A logout audit failure is not a failed restoration.
    await this.access.lock().catch(() => {});
  }
}
export const backupService = new BackupService();
