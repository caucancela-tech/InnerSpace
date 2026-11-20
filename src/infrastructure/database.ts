import Dexie, { type Table } from "dexie";
import type {
  ActivityRecord,
  DailyRecord,
  Settings,
  StoredActivity,
  StoredEnergy,
  StoredEvent,
  StoredJournal,
  StoredMedia,
  StoredMood,
  StoredPreferences,
  StoredReflection,
  Tag,
} from "../domain/validation";

export interface Owner {
  id: "root";
  name: string;
  salt: string;
  passwordHash: string;
  iterations: number;
  createdAt: string;
  updatedAt: string;
  failedAttempts: number;
  lockedUntil: number;
}
export interface Metadata {
  id: string;
  value: string;
  updatedAt: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  createdAt: string;
}
export interface BackupMetadata {
  id: string;
  createdAt: string;
  size: number;
  kind: "export" | "restore";
}
export interface MediaBlob {
  id: string;
  blob: Blob;
}

export const schemaV1 = {
  journalEntries: "id, entryDate, updatedAt, status, *tags",
  moodRecords: "id, &scopeKey, recordedAt, entryReference",
  energyRecords: "id, &scopeKey, recordedAt, entryReference",
  activities: "id, &name, category",
  activityRecords: "id, scopeKey, activityId, recordedAt, entryReference, &[scopeKey+activityId]",
  lifeEvents: "id, eventDate, journalEntryReference, *tags",
  reflections: "id, periodStart, periodEnd",
  tags: "id, &name",
  mediaAssets: "id, mediaType, createdAt",
  mediaBlobs: "id",
  dailyRecords: "id, &date",
  users: "id",
  preferences: "id",
  appSettings: "id",
  databaseMetadata: "id",
  backupMetadata: "id, createdAt",
  migrations: "id",
  auditEvents: "id, createdAt",
};
export const SCHEMA_VERSION = 2;
export const personalTableNames = [
  "journalEntries",
  "moodRecords",
  "energyRecords",
  "activities",
  "activityRecords",
  "lifeEvents",
  "reflections",
  "tags",
  "mediaAssets",
  "mediaBlobs",
  "dailyRecords",
  "preferences",
  "appSettings",
] as const;

export class InnerSpaceDatabase extends Dexie {
  declare journalEntries: Table<StoredJournal, string>;
  declare moodRecords: Table<StoredMood, string>;
  declare energyRecords: Table<StoredEnergy, string>;
  declare activities: Table<StoredActivity, string>;
  declare activityRecords: Table<ActivityRecord, string>;
  declare lifeEvents: Table<StoredEvent, string>;
  declare reflections: Table<StoredReflection, string>;
  declare tags: Table<Tag, string>;
  declare mediaAssets: Table<StoredMedia, string>;
  declare mediaBlobs: Table<MediaBlob, string>;
  declare dailyRecords: Table<DailyRecord, string>;
  declare users: Table<Owner, string>;
  declare preferences: Table<StoredPreferences, string>;
  declare appSettings: Table<Settings, string>;
  declare databaseMetadata: Table<Metadata, string>;
  declare backupMetadata: Table<BackupMetadata, string>;
  declare migrations: Table<Metadata, string>;
  declare auditEvents: Table<AuditEvent, string>;

  constructor(name = "InnerSpace") {
    super(name);
    this.version(1).stores(schemaV1);
    this.version(2)
      .stores({
        ...schemaV1,
        mediaAssets: "id, mediaType, createdAt, updatedAt",
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        await tx
          .table("mediaAssets")
          .toCollection()
          .modify((asset) => {
            asset.updatedAt ||= asset.createdAt;
          });
        await tx.table("migrations").put({
          id: "2",
          value: "Índice y fecha de modificación de archivos",
          updatedAt: now,
        });
        await tx.table("databaseMetadata").put({ id: "schema", value: "2", updatedAt: now });
      });
    this.on("populate", async (tx) => {
      const now = new Date().toISOString();
      await tx
        .table("databaseMetadata")
        .put({ id: "schema", value: String(SCHEMA_VERSION), updatedAt: now });
      await tx
        .table("migrations")
        .put({ id: "1", value: "Creación de tablas locales", updatedAt: now });
      await tx.table("migrations").put({ id: "2", value: "Índice de archivos", updatedAt: now });
    });
    this.on("versionchange", () => this.close());
  }
}
export const db = new InnerSpaceDatabase();
