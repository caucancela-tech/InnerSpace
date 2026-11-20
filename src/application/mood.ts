import type { MoodValue } from "../domain/models";
import { moodSchema, dateSchema } from "../domain/validation";
import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { invariant } from "./errors";

export class MoodService {
  constructor(private database: InnerSpaceDatabase = db) {}
  history(from: string, to: string) {
    return this.database.moodRecords.where("recordedAt").between(from, to, true, true).toArray();
  }
  async replace(date: string, value?: MoodValue, entryReference?: string, context?: string) {
    dateSchema.parse(date);
    const scopeKey = entryReference ? `entry-${entryReference}` : `day-${date}`;
    // Nested calls join the caller's larger journal/checkin transaction.
    await this.database.transaction(
      "rw",
      [this.database.moodRecords, this.database.journalEntries, this.database.dailyRecords],
      async () => {
        const origin = entryReference
          ? await this.database.journalEntries.get(entryReference)
          : await this.database.dailyRecords.get(date);
        invariant(origin, "No existe el registro al que se quiere asociar el ánimo.");
        if ("entryDate" in origin)
          invariant(origin.entryDate === date, "La fecha del ánimo debe coincidir con su entrada.");
        const previous = await this.database.moodRecords.where("scopeKey").equals(scopeKey).first();
        if (value === undefined) {
          await this.database.moodRecords.where("scopeKey").equals(scopeKey).delete();
          return;
        }
        const now = new Date().toISOString();
        await this.database.moodRecords.put(
          moodSchema.parse({
            id: previous?.id || `mood-${entryReference || date}`,
            scopeKey,
            entryReference,
            recordedAt: date,
            moodValue: value,
            optionalContext: context,
            createdAt: previous?.createdAt || now,
            updatedAt: now,
          }),
        );
      },
    );
  }
}
