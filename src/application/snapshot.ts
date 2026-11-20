import { db, personalTableNames, type InnerSpaceDatabase } from "../infrastructure/database";
import type { JournalEntry } from "../domain/models";
import type { Checkin } from "./checkins";
import { defaultPreferences } from "./privacy";

/** One consistent snapshot, re-evaluated by Dexie liveQuery after committed writes, including other tabs. */
export async function readSnapshot(database: InnerSpaceDatabase = db) {
  return database.transaction(
    "r",
    [...personalTableNames.map((name) => database.table(name)), database.users],
    async () => {
      const [
        stored,
        moods,
        energies,
        activityRecords,
        activities,
        lifeEvents,
        reflections,
        mediaAssets,
        days,
        preferences,
        owner,
      ] = await Promise.all([
        database.journalEntries.toArray(),
        database.moodRecords.toArray(),
        database.energyRecords.toArray(),
        database.activityRecords.toArray(),
        database.activities.toArray(),
        database.lifeEvents.toArray(),
        database.reflections.toArray(),
        database.mediaAssets.toArray(),
        database.dailyRecords.toArray(),
        database.preferences.get("owner"),
        database.users.get("root"),
      ]);
      const moodByScope = new Map(moods.map((record) => [record.scopeKey, record]));
      const energyByScope = new Map(energies.map((record) => [record.scopeKey, record]));
      const eventsById = new Map(lifeEvents.map((record) => [record.id, record]));
      const activitiesByScope = new Map<string, string[]>();
      for (const record of activityRecords) {
        const group = activitiesByScope.get(record.scopeKey) || [];
        group.push(record.activityId);
        activitiesByScope.set(record.scopeKey, group);
      }
      const entries: JournalEntry[] = stored
        .map((entry) => ({
          ...entry,
          moodRecord: moodByScope.get(`entry-${entry.id}`),
          energyRecord: energyByScope.get(`entry-${entry.id}`),
          significantEvent: eventsById.get(`event-${entry.id}`),
        }))
        .sort(
          (a, b) =>
            b.entryDate.localeCompare(a.entryDate) || b.updatedAt.localeCompare(a.updatedAt),
        );
      const checkins: Checkin[] = days
        .map((day) => ({
          date: day.date,
          context: day.context,
          mood: moodByScope.get(`day-${day.date}`),
          energy: energyByScope.get(`day-${day.date}`),
          activities: activitiesByScope.get(`day-${day.date}`) || [],
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      // Never expose credential material to React's data context.
      return {
        entries,
        checkins,
        activities,
        lifeEvents,
        reflections,
        mediaAssets,
        moods,
        energies,
        activityRecords,
        preferences: preferences || defaultPreferences,
        initialized: !!owner,
      };
    },
  );
}
