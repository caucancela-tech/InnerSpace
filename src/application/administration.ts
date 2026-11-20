import { db, SCHEMA_VERSION, type InnerSpaceDatabase } from "../infrastructure/database";
import { auth, type AuthService } from "./auth";
import { checkIntegrity, orphanAssets, readPersonalData } from "./integrity";
import { invariant } from "./errors";

export class AdministrationService {
  constructor(
    private database: InnerSpaceDatabase = db,
    private access: AuthService = auth,
  ) {}
  async summary() {
    this.access.assert();
    const data = await readPersonalData(this.database);
    const backups = await this.database.backupMetadata.orderBy("createdAt").reverse().toArray();
    const estimate =
      typeof navigator !== "undefined" && navigator.storage?.estimate
        ? await navigator.storage.estimate().catch(() => undefined)
        : undefined;
    const persisted =
      typeof navigator !== "undefined" && navigator.storage?.persisted
        ? await navigator.storage.persisted().catch(() => false)
        : false;
    return {
      schema: SCHEMA_VERSION,
      counts: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length])),
      bytes: data.mediaAssets.reduce((size, asset) => size + asset.size, 0),
      problems: checkIntegrity(data),
      orphans: orphanAssets(data),
      lastBackup: backups.find((item) => item.kind === "export"),
      estimate,
      persisted,
      settings: await this.database.appSettings.get("system"),
      events: await this.database.auditEvents.orderBy("createdAt").reverse().limit(40).toArray(),
      migrations: await this.database.migrations.toArray(),
    };
  }
  async requestPersistence() {
    this.access.assert();
    invariant(
      navigator.storage?.persist,
      "Este navegador no ofrece una solicitud de almacenamiento duradero.",
    );
    const granted = await navigator.storage.persist();
    await this.database.appSettings.update("system", {
      requestDurableStorage: granted,
    });
    await this.access.log(
      granted
        ? "Almacenamiento duradero concedido"
        : "Almacenamiento duradero no concedido por el navegador",
    );
    return granted;
  }
  async cleanOrphans(confirmation: string) {
    this.access.assert();
    invariant(confirmation === "ELIMINAR", "Escribe ELIMINAR para confirmar.");
    await this.database.transaction(
      "rw",
      [
        this.database.journalEntries,
        this.database.lifeEvents,
        this.database.mediaAssets,
        this.database.mediaBlobs,
        this.database.auditEvents,
      ],
      async () => {
        const entries = await this.database.journalEntries.toArray();
        const events = await this.database.lifeEvents.toArray();
        const used = new Set([...entries, ...events].flatMap((row) => row.mediaReferences));
        const assets = await this.database.mediaAssets.toArray();
        const ids = assets.filter((row) => !used.has(row.id)).map((row) => row.id);
        await this.database.mediaAssets.bulkDelete(ids);
        await this.database.mediaBlobs.bulkDelete(ids);
        await this.access.log(`${ids.length} archivos sin referencias eliminados con confirmación`);
      },
    );
  }
}
export const administrationService = new AdministrationService();
