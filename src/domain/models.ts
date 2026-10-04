export type MoodValue = 'En calma' | 'Con alegría' | 'Con nostalgia' | 'Con inquietud' | 'Sin definir'
export interface MoodRecord { id: string; entryReference?: string; recordedAt: string; moodValue: MoodValue; optionalContext?: string }
export interface EnergyRecord { id: string; entryReference?: string; recordedAt: string; energyValue: number; scaleDefinition: { min: number; max: number } }
export interface Activity { id: string; name: string; category: string; createdAt: string }
export interface LifeEvent { id: string; title: string; description?: string; eventDate: string; tags: string[]; mediaReferences: string[]; journalEntryReference?: string }
export interface JournalEntry { id: string; title?: string; content: string; createdAt: string; updatedAt: string; entryDate: string; tags: string[]; activityReferences: string[]; mediaReferences: string[]; moodRecord?: MoodRecord; energyRecord?: EnergyRecord; significantEvent?: LifeEvent; status: 'draft' | 'saved'; example?: boolean }
export interface Reflection { id: string; periodStart: string; periodEnd: string; responses: Record<string, string>; createdAt: string; updatedAt: string }
export interface MediaAsset { id: string; mediaType: 'photo' | 'audio'; fileReference: string; filename: string; createdAt: string; journalEntryReference?: string }
export interface UserPreferences { theme: 'light' | 'dark' | 'auto'; locale: string; dateFormat: string; accessibilityPreferences: { largeText: boolean; reducedMotion: boolean }; privacyPreferences: { externalConnections: false } }
export type OperationResult<T> = { ok: true; data: T } | { ok: false; error: string }
export interface JournalRepository { list(): Promise<JournalEntry[]>; save(entry: JournalEntry): Promise<OperationResult<JournalEntry>>; remove(id: string): Promise<OperationResult<void>> }
export interface MediaRepository { attach(file: File, entryId?: string): Promise<OperationResult<MediaAsset>> }
export interface AIIntegration { readonly available: false; requestConsent(entryIds: string[]): Promise<boolean> }
export const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export const formatDate = (date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('es', options)
export const landscape = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=85'
export const forest = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=85'
export const sea = 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=800&q=85'
export const examples: JournalEntry[] = [
  { id: 'example-1', title: 'Volver a lo sencillo', content: 'Salí a caminar sin un destino. El aire fresco, los árboles y el sonido de mis pasos me recordaron que no todo necesita una explicación. A veces, estar aquí es suficiente.', entryDate: '2026-10-02', createdAt: '2026-10-02T17:30:00', updatedAt: '2026-10-02T17:30:00', tags: ['Naturaleza', 'Pequeños momentos'], activityReferences: ['Caminar'], mediaReferences: [forest], status: 'saved', example: true },
  { id: 'example-2', title: 'Donde el tiempo se detiene', content: 'Una tarde junto al agua. Dejé el teléfono en la mochila y me quedé mirando el horizonte. Quiero recordar esta sensación de espacio, de no tener que llegar a ningún sitio.', entryDate: '2026-09-28', createdAt: '2026-09-28T18:00:00', updatedAt: '2026-09-28T18:00:00', tags: ['Tranquilidad', 'Viajes'], activityReferences: [], mediaReferences: [sea], status: 'saved', example: true },
  { id: 'example-3', title: 'Una conversación que se queda', content: 'Hoy encontramos tiempo para hablar, sin prisa. Me quedo con lo bonito que es sentirse escuchado y con las cosas pequeñas que nos acercan.', entryDate: '2026-09-25', createdAt: '2026-09-25T20:00:00', updatedAt: '2026-09-25T20:00:00', tags: ['Conexiones'], activityReferences: [], mediaReferences: [], status: 'saved', example: true },
]
