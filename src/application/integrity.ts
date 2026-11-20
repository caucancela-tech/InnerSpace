import type { z } from "zod";
import { dataSchemas } from "../domain/validation";
import {
  db,
  personalTableNames,
  type InnerSpaceDatabase,
  type MediaBlob,
} from "../infrastructure/database";

export type PersonalData = {
  [K in keyof typeof dataSchemas]: z.infer<(typeof dataSchemas)[K]>[];
} & { mediaBlobs: MediaBlob[] };
export async function readPersonalData(database: InnerSpaceDatabase = db): Promise<PersonalData> {
  return database.transaction(
    "r",
    personalTableNames.map((name) => database.table(name)),
    async () =>
      Object.fromEntries(
        await Promise.all(
          personalTableNames.map(async (name) => [name, await database.table(name).toArray()]),
        ),
      ) as PersonalData,
  );
}
export function checkIntegrity(data: PersonalData): string[] {
  const problems: string[] = [];
  for (const [name, schema] of Object.entries(dataSchemas)) {
    const rows = data[name as keyof typeof dataSchemas];
    const ids = new Set<string>();
    for (const row of rows) {
      if (!schema.safeParse(row).success) problems.push(`${name}: estructura inválida (${row.id})`);
      if (ids.has(row.id)) problems.push(`${name}: identificador duplicado (${row.id})`);
      ids.add(row.id);
    }
  }
  const entries = new Map(data.journalEntries.map((row) => [row.id, row]));
  const activities = new Set(data.activities.map((row) => row.id));
  const media = new Map(data.mediaAssets.map((row) => [row.id, row]));
  const tags = new Set(data.tags.map((row) => row.id));
  const blobs = new Map(data.mediaBlobs.map((row) => [row.id, row.blob]));
  const days = new Set(data.dailyRecords.map((row) => row.date));
  const scopes = new Set<string>();
  for (const [name, rows] of [
    ["ánimo", data.moodRecords],
    ["energía", data.energyRecords],
    ["actividad", data.activityRecords],
  ] as const) {
    for (const row of rows) {
      const expected = row.entryReference ? `entry-${row.entryReference}` : `day-${row.recordedAt}`;
      if (row.scopeKey !== expected) problems.push(`${name}: ámbito incoherente (${row.id})`);
      if (row.entryReference ? !entries.has(row.entryReference) : !days.has(row.recordedAt))
        problems.push(`${name}: registro de origen inexistente (${row.id})`);
      if (row.entryReference && entries.get(row.entryReference)?.entryDate !== row.recordedAt)
        problems.push(`${name}: fecha distinta de su entrada (${row.id})`);
      const unique = `${name}-${row.scopeKey}-${"activityId" in row ? row.activityId : ""}`;
      if (scopes.has(unique)) problems.push(`${name}: registro duplicado (${row.id})`);
      scopes.add(unique);
      if ("activityId" in row && !activities.has(row.activityId))
        problems.push(`Actividad inexistente (${row.id})`);
    }
  }
  for (const entry of data.journalEntries) {
    for (const id of entry.activityReferences) {
      if (!activities.has(id)) problems.push(`Actividad inexistente en entrada ${entry.id}`);
      if (
        !data.activityRecords.some(
          (row) => row.entryReference === entry.id && row.activityId === id,
        )
      )
        problems.push(`Asociación de actividad ausente en ${entry.id}`);
    }
    for (const row of data.activityRecords.filter((row) => row.entryReference === entry.id))
      if (!entry.activityReferences.includes(row.activityId))
        problems.push(`Asociación de actividad sobrante en ${entry.id}`);
  }
  for (const record of [...data.journalEntries, ...data.lifeEvents]) {
    for (const id of record.mediaReferences)
      if (!media.has(id)) problems.push(`Archivo inexistente en ${record.id}`);
    for (const id of record.tags)
      if (!tags.has(id)) problems.push(`Etiqueta inexistente en ${record.id}`);
  }
  for (const event of data.lifeEvents)
    if (event.journalEntryReference && !entries.has(event.journalEntryReference))
      problems.push(`Entrada inexistente en acontecimiento ${event.id}`);
  for (const asset of data.mediaAssets) {
    const blob = blobs.get(asset.id);
    if (!(blob instanceof Blob) || blob.size !== asset.size || blob.type !== asset.mimeType)
      problems.push(`Binario ausente o incoherente (${asset.id})`);
  }
  if (data.mediaBlobs.length !== blobs.size) problems.push("Identificadores binarios duplicados");
  for (const id of blobs.keys()) if (!media.has(id)) problems.push(`Binario sin metadatos (${id})`);
  if (new Set(data.activities.map((row) => row.name)).size !== data.activities.length)
    problems.push("Nombres de actividad duplicados");
  if (new Set(data.tags.map((row) => row.name)).size !== data.tags.length)
    problems.push("Nombres de etiqueta duplicados");
  if (data.preferences.length !== 1 || data.appSettings.length !== 1)
    problems.push("Configuración del propietario ausente o duplicada");
  return problems;
}
export function orphanAssets(data: PersonalData) {
  const used = new Set(
    [...data.journalEntries, ...data.lifeEvents].flatMap((record) => record.mediaReferences),
  );
  return data.mediaAssets.filter((asset) => !used.has(asset.id));
}
