import type { MoodRecord, EnergyRecord } from "../domain/models";
import { dailySchema } from "../domain/validation";
import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { invariant } from "./errors";
import { MoodService } from "./mood";
import { EnergyService } from "./energy";

export interface Checkin {
  date: string;
  context: string;
  activities: string[];
  mood?: MoodRecord;
  energy?: EnergyRecord;
}
export class CheckinService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async save(input: Checkin) {
    const now = new Date().toISOString();
    const scopeKey = `day-${input.date}`;
    invariant(
      input.mood || input.energy || input.activities.length || input.context.trim(),
      "Selecciona algún valor o añade contexto.",
    );
    const daily = dailySchema.parse({
      id: input.date,
      date: input.date,
      context: input.context,
      createdAt: now,
      updatedAt: now,
    });
    await this.database.transaction(
      "rw",
      [
        this.database.dailyRecords,
        this.database.moodRecords,
        this.database.energyRecords,
        this.database.activityRecords,
        this.database.activities,
        this.database.journalEntries,
      ],
      async () => {
        invariant(
          (await this.database.activities.bulkGet(input.activities)).every(Boolean),
          "Alguna actividad ya no existe.",
        );
        const old = await this.database.dailyRecords.get(input.date);
        const oldActivities = await this.database.activityRecords
          .where("scopeKey")
          .equals(scopeKey)
          .toArray();
        await this.database.dailyRecords.put({
          ...daily,
          createdAt: old?.createdAt || now,
        });
        await this.database.activityRecords.where("scopeKey").equals(scopeKey).delete();
        await new MoodService(this.database).replace(
          input.date,
          input.mood?.moodValue,
          undefined,
          input.context,
        );
        await new EnergyService(this.database).replace(input.date, input.energy?.energyValue);
        for (const activityId of new Set(input.activities))
          await this.database.activityRecords.add({
            id:
              oldActivities.find((record) => record.activityId === activityId)?.id ||
              crypto.randomUUID(),
            scopeKey,
            recordedAt: input.date,
            activityId,
            createdAt:
              oldActivities.find((record) => record.activityId === activityId)?.createdAt || now,
            updatedAt: now,
          });
      },
    );
  }
  async remove(date: string) {
    await this.database.transaction(
      "rw",
      [
        this.database.dailyRecords,
        this.database.moodRecords,
        this.database.energyRecords,
        this.database.activityRecords,
      ],
      async () => {
        await this.database.dailyRecords.delete(date);
        for (const table of [
          this.database.moodRecords,
          this.database.energyRecords,
          this.database.activityRecords,
        ])
          await table.where("scopeKey").equals(`day-${date}`).delete();
      },
    );
  }
}
export const checkinService = new CheckinService();
