import type { JournalEntry } from "../domain/models";
import type { Checkin } from "./checkins";
export function calendarDates(entries: JournalEntry[], checkins: Checkin[]) {
  return new Set([
    ...entries.map((entry) => entry.entryDate),
    ...checkins.map((record) => record.date),
  ]);
}
