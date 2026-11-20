import { energySchema, dateSchema } from "../domain/validation";
import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { invariant } from "./errors";

export class EnergyService {
  constructor(private database: InnerSpaceDatabase = db) {}
  history(from: string, to: string) {
    return this.database.energyRecords.where("recordedAt").between(from, to, true, true).toArray();
  }
  async replace(date: string, value?: number, entryReference?: string) {
    dateSchema.parse(date);
    const scopeKey = entryReference ? `entry-${entryReference}` : `day-${date}`;
    await this.database.transaction(
      "rw",
      [this.database.energyRecords, this.database.journalEntries, this.database.dailyRecords],
      async () => {
        const origin = entryReference
          ? await this.database.journalEntries.get(entryReference)
          : await this.database.dailyRecords.get(date);
        invariant(origin, "No existe el registro al que se quiere asociar la energía.");
        if ("entryDate" in origin)
          invariant(
            origin.entryDate === date,
            "La fecha de energía debe coincidir con su entrada.",
          );
        const previous = await this.database.energyRecords
          .where("scopeKey")
          .equals(scopeKey)
          .first();
        if (value === undefined) {
          await this.database.energyRecords.where("scopeKey").equals(scopeKey).delete();
          return;
        }
        const now = new Date().toISOString();
        await this.database.energyRecords.put(
          energySchema.parse({
            id: previous?.id || `energy-${entryReference || date}`,
            scopeKey,
            entryReference,
            recordedAt: date,
            energyValue: value,
            scaleDefinition: { min: 1, max: 5 },
            createdAt: previous?.createdAt || now,
            updatedAt: now,
          }),
        );
      },
    );
  }
}
