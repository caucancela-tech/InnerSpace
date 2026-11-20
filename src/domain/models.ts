import type { StoredActivity, StoredMedia, StoredPreferences } from "./validation";

export type MoodValue =
  | "En calma"
  | "Con alegría"
  | "Con nostalgia"
  | "Con inquietud"
  | "Sin definir";
export interface MoodRecord {
  id: string;
  entryReference?: string;
  recordedAt: string;
  moodValue: MoodValue;
  optionalContext?: string;
}
export interface EnergyRecord {
  id: string;
  entryReference?: string;
  recordedAt: string;
  energyValue: number;
  scaleDefinition: { min: number; max: number };
}
export type Activity = StoredActivity;
export interface LifeEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  tags: string[];
  mediaReferences: string[];
  journalEntryReference?: string;
}
export interface JournalEntry {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  entryDate: string;
  tags: string[];
  activityReferences: string[];
  mediaReferences: string[];
  moodRecord?: MoodRecord;
  energyRecord?: EnergyRecord;
  significantEvent?: LifeEvent;
  status: "draft" | "saved";
  example?: boolean;
}
export interface Reflection {
  id: string;
  periodStart: string;
  periodEnd: string;
  responses: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
export type MediaAsset = StoredMedia;
export type UserPreferences = Omit<StoredPreferences, "id">;
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const formatDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("es", options);
export const landscape = `${import.meta.env.BASE_URL}images/landscape.jpg`;
export const forest = `${import.meta.env.BASE_URL}images/forest.jpg`;
export const sea = `${import.meta.env.BASE_URL}images/sea.jpg`;
export const examples: JournalEntry[] = [
  {
    id: "example-1",
    title: "Volver a lo sencillo",
    content:
      "Salí a caminar sin un destino. El aire fresco, los árboles y el sonido de mis pasos me recordaron que no todo necesita una explicación. A veces, estar aquí es suficiente.",
    entryDate: "2026-10-02",
    createdAt: "2026-10-02T17:30:00",
    updatedAt: "2026-10-02T17:30:00",
    tags: ["Naturaleza", "Pequeños momentos"],
    activityReferences: ["Caminar"],
    mediaReferences: [forest],
    status: "saved",
    example: true,
  },
  {
    id: "example-2",
    title: "Donde el tiempo se detiene",
    content:
      "Una tarde junto al agua. Dejé el teléfono en la mochila y me quedé mirando el horizonte. Quiero recordar esta sensación de espacio, de no tener que llegar a ningún sitio.",
    entryDate: "2026-09-28",
    createdAt: "2026-09-28T18:00:00",
    updatedAt: "2026-09-28T18:00:00",
    tags: ["Tranquilidad", "Viajes"],
    activityReferences: [],
    mediaReferences: [sea],
    status: "saved",
    example: true,
  },
  {
    id: "example-3",
    title: "Una conversación que se queda",
    content:
      "Hoy encontramos tiempo para hablar, sin prisa. Me quedo con lo bonito que es sentirse escuchado y con las cosas pequeñas que nos acercan.",
    entryDate: "2026-09-25",
    createdAt: "2026-09-25T20:00:00",
    updatedAt: "2026-09-25T20:00:00",
    tags: ["Conexiones"],
    activityReferences: [],
    mediaReferences: [],
    status: "saved",
    example: true,
  },
];
