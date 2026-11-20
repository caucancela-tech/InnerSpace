import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { eventSchema, type StoredEvent } from "../domain/validation";
import { invariant } from "./errors";

export class TimelineService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async save(event: StoredEvent) {
    const record = eventSchema.parse({
      ...event,
      tags: [...new Set(event.tags.map((tag) => tag.trim()).filter(Boolean))],
    });
    await this.database.transaction(
      "rw",
      [
        this.database.lifeEvents,
        this.database.journalEntries,
        this.database.mediaAssets,
        this.database.tags,
      ],
      async () => {
        if (record.journalEntryReference)
          invariant(
            await this.database.journalEntries.get(record.journalEntryReference),
            "La entrada vinculada no existe.",
          );
        invariant(
          (await this.database.mediaAssets.bulkGet(record.mediaReferences)).every(Boolean),
          "Un archivo vinculado no existe.",
        );
        const old = await this.database.lifeEvents.get(record.id);
        record.createdAt = old?.createdAt || record.createdAt;
        await this.database.lifeEvents.put(record);
        if (record.journalEntryReference && record.id === `event-${record.journalEntryReference}`) {
          await this.database.journalEntries.update(record.journalEntryReference, {
            updatedAt: record.updatedAt,
          });
        }
        for (const name of record.tags)
          if (!(await this.database.tags.get(name)))
            await this.database.tags.add({
              id: name,
              name,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            });
      },
    );
  }
  remove(id: string) {
    return this.database.lifeEvents.delete(id);
  }
}
export const timelineService = new TimelineService();
