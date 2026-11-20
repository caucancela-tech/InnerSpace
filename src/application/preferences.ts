import { db, type InnerSpaceDatabase } from "../infrastructure/database";
import { preferencesSchema, type StoredPreferences } from "../domain/validation";
import { defaultPreferences } from "./privacy";

export interface PreferencesPatch {
  theme?: StoredPreferences["theme"];
  accessibilityPreferences?: Partial<StoredPreferences["accessibilityPreferences"]>;
}
export class PreferencesService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async update(patch: PreferencesPatch) {
    return this.database.transaction("rw", this.database.preferences, async () => {
      const current = (await this.database.preferences.get("owner")) || defaultPreferences;
      const next = preferencesSchema.parse({
        ...current,
        ...patch,
        accessibilityPreferences: {
          ...current.accessibilityPreferences,
          ...patch.accessibilityPreferences,
        },
      });
      await this.database.preferences.put(next);
      return next;
    });
  }
}
export const preferencesService = new PreferencesService();
