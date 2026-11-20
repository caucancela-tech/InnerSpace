import type { JournalEntry } from "../domain/models";

export interface SearchFilter {
  text: string;
  from?: string;
  to?: string;
  tag?: string;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
export function searchEntries(entries: JournalEntry[], filter: SearchFilter) {
  const query = normalize(filter.text.trim());
  return entries
    .filter(
      (entry) =>
        normalize(`${entry.title || ""} ${entry.content} ${entry.tags.join(" ")}`).includes(
          query,
        ) &&
        (!filter.from || entry.entryDate >= filter.from) &&
        (!filter.to || entry.entryDate <= filter.to) &&
        (!filter.tag || entry.tags.includes(filter.tag)),
    )
    .sort(
      (a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt.localeCompare(a.updatedAt),
    );
}
