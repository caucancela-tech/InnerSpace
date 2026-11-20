import type { JournalEntry } from "../domain/models";
import { journalSchema, eventSchema } from "../domain/validation";
import { db, personalTableNames, type InnerSpaceDatabase } from "../infrastructure/database";
import { invariant } from "./errors";
import { prepareMedia } from "./media";
import { MoodService } from "./mood";
import { EnergyService } from "./energy";

export class JournalService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async save(input: JournalEntry, files: File[] = [], expectedUpdatedAt?: string) {
    invariant(!input.example, "Los ejemplos no se pueden guardar como datos personales.");
    const prepared = await Promise.all(files.map(prepareMedia));
    const { moodRecord, energyRecord, significantEvent, example: _example, ...base } = input;
    const entry = journalSchema.parse({
      ...base,
      tags: [...new Set(base.tags)],
      mediaReferences: [
        ...new Set([...base.mediaReferences, ...prepared.map((file) => file.asset.id)]),
      ],
    });
    const now = new Date().toISOString();
    const scopeKey = `entry-${entry.id}`;
    await this.database.transaction(
      "rw",
      personalTableNames.map((name) => this.database.table(name)),
      async () => {
        const old = await this.database.journalEntries.get(entry.id);
        if (expectedUpdatedAt !== undefined)
          invariant(
            old?.updatedAt === expectedUpdatedAt,
            "Esta entrada cambió o se eliminó en otra vista. Tu texto sigue aquí: cópialo antes de recargar para comparar las versiones.",
          );
        entry.createdAt = old?.createdAt || entry.createdAt;
        entry.updatedAt = new Date(
          Math.max(Date.now(), Date.parse(old?.updatedAt || now) + 1),
        ).toISOString();
        const oldActivities = await this.database.activityRecords
          .where("scopeKey")
          .equals(scopeKey)
          .toArray();
        const activities = await this.database.activities.bulkGet(entry.activityReferences);
        invariant(activities.every(Boolean), "Una actividad ya no existe. Actualiza su selección.");
        const media = await this.database.mediaAssets.bulkGet(base.mediaReferences);
        invariant(media.every(Boolean), "Un archivo ya no existe. Actualiza su selección.");
        await this.database.journalEntries.put(entry);
        for (const tag of entry.tags) {
          if (!(await this.database.tags.get(tag)))
            await this.database.tags.add({
              id: tag,
              name: tag,
              createdAt: now,
              updatedAt: now,
            });
        }
        for (const file of prepared) {
          await this.database.mediaAssets.add(file.asset);
          await this.database.mediaBlobs.add({
            id: file.asset.id,
            blob: file.blob,
          });
        }
        await this.database.activityRecords.where("scopeKey").equals(scopeKey).delete();
        await new MoodService(this.database).replace(
          entry.entryDate,
          moodRecord?.moodValue,
          entry.id,
          moodRecord?.optionalContext,
        );
        await new EnergyService(this.database).replace(
          entry.entryDate,
          energyRecord?.energyValue,
          entry.id,
        );
        for (const activityId of entry.activityReferences)
          await this.database.activityRecords.put({
            id:
              oldActivities.find((record) => record.activityId === activityId)?.id ||
              crypto.randomUUID(),
            scopeKey,
            activityId,
            entryReference: entry.id,
            recordedAt: entry.entryDate,
            createdAt:
              oldActivities.find((record) => record.activityId === activityId)?.createdAt || now,
            updatedAt: now,
          });
        // Only the editor-owned event is updated here; independently created events remain independent.
        const eventId = `event-${entry.id}`;
        if (significantEvent) {
          const previous = await this.database.lifeEvents.get(eventId);
          await this.database.lifeEvents.put(
            eventSchema.parse({
              ...significantEvent,
              description: significantEvent.description || entry.content,
              id: eventId,
              journalEntryReference: entry.id,
              eventDate: entry.entryDate,
              tags: entry.tags,
              mediaReferences: entry.mediaReferences,
              createdAt: previous?.createdAt || now,
              updatedAt: now,
            }),
          );
        } else await this.database.lifeEvents.delete(eventId);
      },
    );
    return entry;
  }
  async remove(id: string) {
    await this.database.transaction(
      "rw",
      personalTableNames.map((name) => this.database.table(name)),
      async () => {
        await this.database.journalEntries.delete(id);
        await this.database.moodRecords.where("entryReference").equals(id).delete();
        await this.database.energyRecords.where("entryReference").equals(id).delete();
        await this.database.activityRecords.where("entryReference").equals(id).delete();
        // Life events and media survive as independent memories, with no dangling entry reference.
        await this.database.lifeEvents
          .where("journalEntryReference")
          .equals(id)
          .modify((event) => {
            delete event.journalEntryReference;
            event.updatedAt = new Date().toISOString();
          });
      },
    );
  }
}
export const journalService = new JournalService();
