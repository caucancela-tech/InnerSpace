import type { Table } from "dexie";
import type { ZodType } from "zod";
import { db, type InnerSpaceDatabase } from "./database";
import { dataSchemas, type StoredJournal } from "../domain/validation";

/** Repository validation is shared by every caller; multi-entity writes belong to services. */
export class Repository<T extends { id: string }> {
  constructor(
    private table: Table<T, string>,
    private schema: ZodType<T>,
  ) {}
  list() {
    return this.table.toArray();
  }
  get(id: string) {
    return this.table.get(id);
  }
  async save(value: T) {
    const record = this.schema.parse(value);
    await this.table.put(record);
    return record;
  }
}
export class JournalRepository extends Repository<StoredJournal> {
  constructor(private database: InnerSpaceDatabase) {
    super(database.journalEntries, dataSchemas.journalEntries);
  }
  between(from: string, to: string) {
    return this.database.journalEntries.where("entryDate").between(from, to, true, true).toArray();
  }
  tagged(tag: string) {
    return this.database.journalEntries.where("tags").equals(tag).toArray();
  }
}
export function repositories(database = db) {
  return {
    journal: new JournalRepository(database),
    reflections: new Repository(database.reflections, dataSchemas.reflections),
    events: new Repository(database.lifeEvents, dataSchemas.lifeEvents),
    activities: new Repository(database.activities, dataSchemas.activities),
    preferences: new Repository(database.preferences, dataSchemas.preferences),
  };
}
