import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { InnerSpaceDatabase, schemaV1 } from "../src/infrastructure/database";
import { JournalService } from "../src/application/journal";
import { ActivityService } from "../src/application/activities";
import { CheckinService } from "../src/application/checkins";
import { MediaService } from "../src/application/media";
import { TimelineService } from "../src/application/timeline";
import { ReflectionService } from "../src/application/reflections";
import { AuthService } from "../src/application/auth";
import { BackupService } from "../src/application/backup";
import { AdministrationService } from "../src/application/administration";
import { readSnapshot } from "../src/application/snapshot";
import { checkIntegrity, readPersonalData } from "../src/application/integrity";
import { searchEntries } from "../src/application/search";
import { calendarDates } from "../src/application/calendar";
import { repositories } from "../src/infrastructure/repositories";
import { PreferencesService } from "../src/application/preferences";
import type { JournalEntry } from "../src/domain/models";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const password = "una frase privada de pruebas";
const now = "2026-06-15T12:00:00.000Z";
function entry(id = "entry-one"): JournalEntry {
  return {
    id,
    title: "Una tarde de calma",
    content: "Un recuerdo mío",
    entryDate: "2026-06-15",
    createdAt: now,
    updatedAt: now,
    tags: ["Calma"],
    activityReferences: [],
    mediaReferences: [],
    status: "saved",
  };
}
const png = () =>
  new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], "foto.png", {
    type: "image/png",
  });
let database: InnerSpaceDatabase;
let journal: JournalService;
let access: AuthService;
beforeEach(async () => {
  database = new InnerSpaceDatabase(`test-${crypto.randomUUID()}`);
  await database.open();
  journal = new JournalService(database);
  access = new AuthService(database);
});
afterEach(async () => {
  await database.delete();
});

describe("persistencia, consultas e integridad", () => {
  it("combina cambios concurrentes de preferencias sin perder opciones", async () => {
    const preferences = new PreferencesService(database);
    await Promise.all([
      preferences.update({ theme: "dark" }),
      preferences.update({ accessibilityPreferences: { largeText: true } }),
      preferences.update({ accessibilityPreferences: { reducedMotion: true } }),
    ]);
    expect(await database.preferences.get("owner")).toMatchObject({
      theme: "dark",
      accessibilityPreferences: { largeText: true, reducedMotion: true },
    });
    database.close();
    await database.open();
    expect((await database.preferences.get("owner"))?.theme).toBe("dark");
  });
  it("evita sobrescribir una entrada editada desde otra pestaña", async () => {
    const original = await journal.save(entry());
    await journal.save(
      { ...entry(), content: "Cambio desde otra pestaña" },
      [],
      original.updatedAt,
    );
    await expect(
      journal.save({ ...entry(), content: "Cambio obsoleto" }, [], original.updatedAt),
    ).rejects.toThrow("otra vista");
    expect((await database.journalEntries.get(original.id))?.content).toBe(
      "Cambio desde otra pestaña",
    );
  });
  it("crea, cierra, reabre, modifica y elimina con persistencia real del motor IndexedDB", async () => {
    const name = database.name;
    await journal.save(entry());
    database.close();
    database = new InnerSpaceDatabase(name);
    await database.open();
    journal = new JournalService(database);
    expect((await readSnapshot(database)).entries[0].content).toBe("Un recuerdo mío");
    await journal.save({
      ...(await readSnapshot(database)).entries[0],
      content: "Contenido modificado",
    });
    database.close();
    await database.open();
    expect(
      (await repositories(database).journal.between("2026-06-01", "2026-06-30"))[0].content,
    ).toBe("Contenido modificado");
    expect(await repositories(database).journal.tagged("Calma")).toHaveLength(1);
    await journal.remove("entry-one");
    database.close();
    await database.open();
    expect(await database.journalEntries.count()).toBe(0);
  });
  it("guarda borradores vacíos, pero rechaza entradas vacías y fechas imposibles", async () => {
    await journal.save({ ...entry(), content: "", status: "draft" });
    await expect(journal.save({ ...entry(), content: "" })).rejects.toThrow();
    await expect(journal.save({ ...entry(), entryDate: "2026-02-30" })).rejects.toThrow();
    expect((await database.journalEntries.get("entry-one"))?.status).toBe("draft");
  });
  it("relaciona ánimo, energía, actividades y binarios; actualiza sin duplicar y elimina coherentemente", async () => {
    await access.setup("Propietaria", password);
    const activityService = new ActivityService(database);
    const activity = await activityService.save("Caminar");
    const input = {
      ...entry(),
      activityReferences: [activity.id],
      moodRecord: { id: "mood-test", recordedAt: now, moodValue: "En calma" as const },
      energyRecord: {
        id: "energy-test",
        recordedAt: now,
        energyValue: 3,
        scaleDefinition: { min: 1, max: 5 },
      },
      significantEvent: {
        id: "event-test",
        title: "Un cambio",
        eventDate: "2026-06-15",
        tags: [],
        mediaReferences: [],
      },
    };
    await journal.save(input, [png()]);
    let snapshot = await readSnapshot(database);
    const mediaId = snapshot.entries[0].mediaReferences[0];
    await journal.save({ ...snapshot.entries[0], content: "Edición" });
    expect(await database.moodRecords.count()).toBe(1);
    expect(await database.energyRecords.count()).toBe(1);
    expect(await database.activityRecords.count()).toBe(1);
    expect(checkIntegrity(await readPersonalData(database))).toEqual([]);
    await activityService.save("Pasear", "Aire libre", activity.id);
    expect((await database.activities.get(activity.id))?.name).toBe("Pasear");
    await activityService.remove(activity.id);
    snapshot = await readSnapshot(database);
    expect(snapshot.entries[0].activityReferences).toEqual([]);
    expect(await database.activityRecords.count()).toBe(0);
    await journal.remove(input.id);
    expect(await database.moodRecords.count()).toBe(0);
    expect(await database.energyRecords.count()).toBe(0);
    expect((await database.lifeEvents.toArray())[0].journalEntryReference).toBeUndefined();
    expect(await database.mediaBlobs.count()).toBe(1);
    await new MediaService(database).remove(mediaId);
    expect(await database.mediaBlobs.count()).toBe(0);
    expect((await database.lifeEvents.toArray())[0].mediaReferences).toEqual([]);
    expect(checkIntegrity(await readPersonalData(database))).toEqual([]);
  });
  it("rechaza relaciones inexistentes y revierte todas las escrituras", async () => {
    await expect(
      journal.save({ ...entry(), activityReferences: ["missing"] }, [png()]),
    ).rejects.toThrow();
    expect(await database.journalEntries.count()).toBe(0);
    expect(await database.mediaBlobs.count()).toBe(0);
    await expect(
      journal.save(entry(), [new File(["html"], "fake.png", { type: "image/png" })]),
    ).rejects.toThrow();
  });
  it("actualiza registros breves por día, históricos y calendario sin duplicarlos", async () => {
    const service = new CheckinService(database);
    const record = {
      date: "2026-06-15",
      context: "En casa",
      activities: [],
      mood: { id: "mood-day", recordedAt: now, moodValue: "Con alegría" as const },
      energy: {
        id: "energy-day",
        recordedAt: now,
        energyValue: 2,
        scaleDefinition: { min: 1, max: 5 },
      },
    };
    await Promise.all([service.save(record), service.save(record)]);
    await service.save({
      ...record,
      context: "Otro contexto",
      energy: { ...record.energy, energyValue: 4 },
    });
    expect(await database.dailyRecords.count()).toBe(1);
    expect(await database.moodRecords.count()).toBe(1);
    expect((await database.energyRecords.toArray())[0].energyValue).toBe(4);
    const snapshot = await readSnapshot(database);
    expect(calendarDates(snapshot.entries, snapshot.checkins).has(record.date)).toBe(true);
    await service.remove(record.date);
    expect(await database.moodRecords.count()).toBe(0);
  });
  it("acontecimientos independientes, reflexiones parciales y búsquedas con fechas y etiquetas", async () => {
    const timeline = new TimelineService(database);
    await timeline.save({
      id: "independent",
      title: "Un comienzo",
      eventDate: "2026-06-01",
      tags: [],
      mediaReferences: [],
      createdAt: now,
      updatedAt: now,
    });
    await timeline.save({
      ...(await database.lifeEvents.get("independent"))!,
      title: "Otro comienzo",
    });
    const reflection = {
      id: "reflection",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      responses: { Pregunta: "Algo", Otra: "" },
      createdAt: now,
      updatedAt: now,
    };
    await new ReflectionService(database).save(reflection);
    await new ReflectionService(database).save({
      ...reflection,
      responses: { Pregunta: "Edición", Otra: "" },
    });
    await journal.save(entry());
    const snapshot = await readSnapshot(database);
    expect(snapshot.lifeEvents[0].title).toBe("Otro comienzo");
    expect(snapshot.reflections[0].responses.Otra).toBe("");
    expect(
      searchEntries(snapshot.entries, {
        text: "MIO",
        from: "2026-06-01",
        to: "2026-06-30",
        tag: "Calma",
      }),
    ).toHaveLength(1);
    expect(searchEntries(snapshot.entries, { text: "", from: "2026-07-01" })).toHaveLength(0);
    await timeline.remove("independent");
    expect(await database.lifeEvents.count()).toBe(0);
  });
  it("migra v1 a v2 conservando datos, binarios y propietario", async () => {
    await database.delete();
    const legacy = new Dexie(database.name);
    legacy.version(1).stores(schemaV1);
    await legacy.open();
    await legacy.table("journalEntries").put(entry());
    await legacy.table("mediaAssets").put({ id: "old-photo", mediaType: "photo", createdAt: now });
    await legacy.table("mediaBlobs").put({ id: "old-photo", blob: png() });
    legacy.close();
    await database.open();
    expect(await database.journalEntries.count()).toBe(1);
    expect((await database.mediaAssets.get("old-photo"))?.updatedAt).toBe(now);
    expect(await database.mediaBlobs.count()).toBe(1);
    expect(await database.migrations.get("2")).toBeDefined();
    expect((await database.databaseMetadata.get("schema"))?.value).toBe("2");
  });
});

describe("propietario y sesiones administrativas", () => {
  it("solo inicializa un propietario ante dos conexiones concurrentes y sin contraseñas planas", async () => {
    const other = new InnerSpaceDatabase(database.name);
    const results = await Promise.allSettled([
      access.setup("Uno", password),
      new AuthService(other).setup("Dos", password),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await database.users.count()).toBe(1);
    const owner = await database.users.get("root");
    expect(JSON.stringify(owner)).not.toContain(password);
    expect(owner?.iterations).toBe(600_000);
    expect(await database.preferences.count()).toBe(1);
    other.close();
    await expect(access.setup("Tres", password)).rejects.toThrow("ya está configurado");
  });
  it("valida acceso, bloqueo, expiración, cambio de contraseña y cierre de sesión", async () => {
    let clock = 10_000;
    const session = new AuthService(database, () => clock);
    await expect(session.setup("A", "corta")).rejects.toThrow();
    await session.setup("Propietaria", password);
    expect(session.valid()).toBe(true);
    await session.lock();
    await expect(session.login("incorrecta")).rejects.toThrow("incorrecta");
    expect(() => session.assert()).toThrow();
    await session.login(password);
    await session.setTimeout(1);
    clock += 60_001;
    expect(session.valid()).toBe(false);
    expect(session.snapshot()).toBe("expired");
    await session.login(password);
    await session.changePassword(password, "otra frase privada distinta");
    expect(session.valid()).toBe(false);
    await expect(session.login(password)).rejects.toThrow("incorrecta");
    await session.login("otra frase privada distinta");
    expect(session.valid()).toBe(true);
    expect(new AuthService(database).valid()).toBe(false);
  });
  it("las operaciones administrativas exigen sesión y registran eventos sin contenido", async () => {
    const admin = new AdministrationService(database, access);
    await expect(admin.summary()).rejects.toThrow("Sesión");
    await access.setup("Propietaria", password);
    expect((await admin.summary()).counts.journalEntries).toBe(0);
    expect((await admin.summary()).events.length).toBeGreaterThan(0);
    await access.lock();
    await expect(new BackupService(database, access).export()).rejects.toThrow();
  });
});

describe("respaldo completo y restauración atómica", () => {
  it("permite descargar un respaldo aunque no haya cuota para anotar su fecha", async () => {
    await journal.save(entry());
    const failure = () => {
      throw new DOMException("Sin espacio", "QuotaExceededError");
    };
    database.backupMetadata.hook("creating", failure);
    const backup = new BackupService(database, access);
    let warning = "";
    const blob = await backup.export((message) => {
      warning = message;
    });
    database.backupMetadata.hook("creating").unsubscribe(failure);
    expect(warning).toContain("no se pudo registrar");
    expect((await backup.inspect(blob)).data.journalEntries).toHaveLength(1);
    expect(await database.backupMetadata.count()).toBe(0);
  });
  it("no informa una restauración fallida si solo falla la auditoría posterior del cierre de sesión", async () => {
    await journal.save(entry());
    const backup = new BackupService(database, access);
    const prepared = await backup.inspect(await backup.export());
    await journal.save(entry("extra"));
    const log = access.log.bind(access);
    const spy = vi.spyOn(access, "log").mockImplementation(async (action) => {
      if (action === "Sesión administrativa cerrada")
        throw new Error("Fallo de auditoría posterior");
      await log(action);
    });
    await expect(backup.restore(prepared, "RESTAURAR")).resolves.toBeUndefined();
    expect(await database.journalEntries.count()).toBe(1);
    expect(access.valid()).toBe(false);
    spy.mockRestore();
  });
  beforeEach(async () => {
    await access.setup("Propietaria", password);
  });
  it("conserva binarios, relaciones y preferencias; exige confirmar reemplazo de datos", async () => {
    await journal.save(entry(), [png(), new File(["ID3audio"], "voz.mp3", { type: "audio/mpeg" })]);
    await repositories(database).preferences.save({
      ...(await database.preferences.get("owner"))!,
      theme: "dark",
    });
    const backup = new BackupService(database, access);
    const blob = await backup.export();
    const prepared = await backup.inspect(blob);
    expect(prepared.data.mediaBlobs).toHaveLength(2);
    await journal.save(entry("another"));
    await expect(backup.restore(prepared, "")).rejects.toThrow("RESTAURAR");
    expect(await database.journalEntries.count()).toBe(2);
    const hash = (await database.users.get("root"))?.passwordHash;
    await backup.restore(prepared, "RESTAURAR");
    expect(await database.journalEntries.count()).toBe(1);
    expect((await database.preferences.get("owner"))?.theme).toBe("dark");
    expect((await database.users.get("root"))?.passwordHash).toBe(hash);
    const files = await database.mediaBlobs.toArray();
    expect(new Uint8Array(await files[0].blob.arrayBuffer()).length).toBeGreaterThan(0);
    expect(checkIntegrity(await readPersonalData(database))).toEqual([]);
    expect(access.valid()).toBe(false);
  });
  it("rechaza corrupción, versión incompatible y archivos ausentes sin tocar la base", async () => {
    await journal.save(entry(), [png()]);
    const backup = new BackupService(database, access);
    const blob = await backup.export();
    await expect(backup.inspect(new Blob(["corrupto"]))).rejects.toThrow();
    const bytes = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(bytes["manifest.json"]));
    manifest.version = 999;
    await expect(
      backup.inspect(
        new Blob([zipSync({ ...bytes, "manifest.json": strToU8(JSON.stringify(manifest)) })]),
      ),
    ).rejects.toThrow("incompatible");
    delete bytes[Object.keys(bytes).find((key) => key.startsWith("media/"))!];
    await expect(backup.inspect(new Blob([zipSync(bytes)]))).rejects.toThrow();
    expect(await database.journalEntries.count()).toBe(1);
    expect(await database.mediaBlobs.count()).toBe(1);
  });
  it("revierte una restauración si falla una escritura dentro de la transacción", async () => {
    await journal.save(entry());
    const backup = new BackupService(database, access);
    const prepared = await backup.inspect(await backup.export());
    await journal.save(entry("must-survive"));
    const fail = () => {
      throw new DOMException("Sin espacio", "QuotaExceededError");
    };
    database.reflections.hook("creating", fail);
    prepared.data.reflections.push({
      id: "trigger",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-07",
      responses: { Q: "A" },
      createdAt: now,
      updatedAt: now,
    });
    await expect(backup.restore(prepared, "RESTAURAR")).rejects.toThrow();
    database.reflections.hook("creating").unsubscribe(fail);
    expect(await database.journalEntries.count()).toBe(2);
    expect(await database.journalEntries.get("must-survive")).toBeDefined();
  });
  it("detecta referencias corruptas sin repararlas destructivamente", async () => {
    await journal.save(entry());
    await database.journalEntries.update("entry-one", { mediaReferences: ["missing"] });
    const problems = checkIntegrity(await readPersonalData(database));
    expect(problems.some((problem) => problem.includes("Archivo inexistente"))).toBe(true);
    await expect(new BackupService(database, access).export()).rejects.toThrow("integridad");
    expect(await database.journalEntries.count()).toBe(1);
  });
});
