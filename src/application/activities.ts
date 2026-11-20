import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { activitySchema } from "../domain/validation";
import { repositories } from "../infrastructure/repositories";

export class ActivityService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async save(name: string, category = "Personal", id = crypto.randomUUID() as string) {
    const now = new Date().toISOString();
    const previous = await this.database.activities.get(id);
    return repositories(this.database).activities.save(
      activitySchema.parse({
        id,
        name: name.trim(),
        category: category.trim(),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      }),
    );
  }
  async remove(id: string) {
    await this.database.transaction(
      "rw",
      [this.database.activities, this.database.activityRecords, this.database.journalEntries],
      async () => {
        await this.database.activities.delete(id);
        await this.database.activityRecords.where("activityId").equals(id).delete();
        await this.database.journalEntries.toCollection().modify((entry) => {
          if (!entry.activityReferences.includes(id)) return false;
          entry.activityReferences = entry.activityReferences.filter((ref) => ref !== id);
          entry.updatedAt = new Date().toISOString();
        });
      },
    );
  }
}
export const activityService = new ActivityService();
