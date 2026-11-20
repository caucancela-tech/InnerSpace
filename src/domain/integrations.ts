/** Future adapters only. None is instantiated or has network access in this phase. */
export interface Consent {
  entryIds: string[];
  purpose: string;
  grantedAt: string;
}
export interface OptionalSyncAdapter {
  readonly enabled: boolean;
  synchronize(consent: Consent): Promise<void>;
}
export interface OptionalInsightAdapter {
  readonly enabled: boolean;
  describe(
    consent: Consent,
    readonlyEntries: ReadonlyArray<Readonly<{ id: string; content: string }>>,
  ): Promise<string>;
}
export interface SemanticSearchAdapter {
  search(query: string, consent: Consent): Promise<string[]>;
}
export interface DeviceImportAdapter {
  inspect(file: File): Promise<{ version: number; records: number }>;
}
// No adapter can mutate original journal entries; applying suggestions requires a separate user action.
