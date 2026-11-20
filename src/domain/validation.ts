import { z } from "zod";

export const idSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\w -]+$/u);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Fecha no válida");
const timestamp = z.string().datetime({ offset: true });
const timestamps = { createdAt: timestamp, updatedAt: timestamp };
const names = z
  .array(z.string().trim().min(1).max(80))
  .max(100)
  .refine((values) => new Set(values).size === values.length, "Referencias duplicadas");
const ids = z
  .array(idSchema)
  .max(100)
  .refine((values) => new Set(values).size === values.length, "Referencias duplicadas");
export const moodValueSchema = z.enum([
  "En calma",
  "Con alegría",
  "Con nostalgia",
  "Con inquietud",
  "Sin definir",
]);
export const journalSchema = z
  .object({
    id: idSchema,
    title: z.string().max(250).optional(),
    content: z.string().max(500_000),
    ...timestamps,
    entryDate: dateSchema,
    tags: names,
    activityReferences: ids,
    mediaReferences: ids,
    status: z.enum(["draft", "saved"]),
  })
  .strict()
  .refine(
    (value) => value.status === "draft" || value.content.trim().length > 0,
    "Escribe algo antes de guardar",
  );
export const moodSchema = z
  .object({
    id: idSchema,
    scopeKey: idSchema,
    entryReference: idSchema.optional(),
    recordedAt: dateSchema,
    moodValue: moodValueSchema,
    optionalContext: z.string().max(10_000).optional(),
    ...timestamps,
  })
  .strict();
export const energySchema = z
  .object({
    id: idSchema,
    scopeKey: idSchema,
    entryReference: idSchema.optional(),
    recordedAt: dateSchema,
    energyValue: z.number().int().min(1).max(5),
    scaleDefinition: z.object({ min: z.literal(1), max: z.literal(5) }).strict(),
    ...timestamps,
  })
  .strict();
export const activitySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(80),
    category: z.string().trim().min(1).max(80),
    ...timestamps,
  })
  .strict();
export const activityRecordSchema = z
  .object({
    id: idSchema,
    scopeKey: idSchema,
    activityId: idSchema,
    entryReference: idSchema.optional(),
    recordedAt: dateSchema,
    ...timestamps,
  })
  .strict();
export const eventSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).max(250),
    description: z.string().max(50_000).optional(),
    eventDate: dateSchema,
    tags: names,
    mediaReferences: ids,
    journalEntryReference: idSchema.optional(),
    ...timestamps,
  })
  .strict();
export const reflectionSchema = z
  .object({
    id: idSchema,
    periodStart: dateSchema,
    periodEnd: dateSchema,
    responses: z.record(z.string().min(1).max(300), z.string().max(50_000)),
    ...timestamps,
  })
  .strict()
  .refine((value) => value.periodStart <= value.periodEnd, "Periodo no válido");
export const mediaSchema = z
  .object({
    id: idSchema,
    mediaType: z.enum(["photo", "audio"]),
    filename: z.string().min(1).max(250),
    mimeType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ]),
    size: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    ...timestamps,
  })
  .strict();
export const preferencesSchema = z
  .object({
    id: z.literal("owner"),
    theme: z.enum(["light", "dark", "auto"]),
    locale: z.literal("es"),
    dateFormat: z.literal("long"),
    accessibilityPreferences: z
      .object({ largeText: z.boolean(), reducedMotion: z.boolean() })
      .strict(),
    privacyPreferences: z.object({ externalConnections: z.literal(false) }).strict(),
  })
  .strict();
export const settingsSchema = z
  .object({
    id: z.literal("system"),
    autoLockMinutes: z.number().int().min(1).max(60),
    requestDurableStorage: z.boolean(),
  })
  .strict();
export const tagSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(80),
    ...timestamps,
  })
  .strict();
export const dailySchema = z
  .object({
    id: dateSchema,
    date: dateSchema,
    context: z.string().max(10_000),
    ...timestamps,
  })
  .strict()
  .refine((value) => value.id === value.date, "Fecha incoherente");

export const dataSchemas = {
  journalEntries: journalSchema,
  moodRecords: moodSchema,
  energyRecords: energySchema,
  activities: activitySchema,
  activityRecords: activityRecordSchema,
  lifeEvents: eventSchema,
  reflections: reflectionSchema,
  tags: tagSchema,
  mediaAssets: mediaSchema,
  dailyRecords: dailySchema,
  preferences: preferencesSchema,
  appSettings: settingsSchema,
};
export type StoredJournal = z.infer<typeof journalSchema>;
export type StoredMood = z.infer<typeof moodSchema>;
export type StoredEnergy = z.infer<typeof energySchema>;
export type StoredActivity = z.infer<typeof activitySchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
export type StoredEvent = z.infer<typeof eventSchema>;
export type StoredReflection = z.infer<typeof reflectionSchema>;
export type StoredMedia = z.infer<typeof mediaSchema>;
export type StoredPreferences = z.infer<typeof preferencesSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type DailyRecord = z.infer<typeof dailySchema>;
