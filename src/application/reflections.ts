import type { Reflection } from "../domain/models";
import { repositories } from "../infrastructure/repositories";
import { db, type InnerSpaceDatabase } from "../infrastructure/database";

export class ReflectionService {
  constructor(private database: InnerSpaceDatabase = db) {}
  async save(reflection: Reflection) {
    return this.database.transaction("rw", this.database.reflections, async () => {
      const old = await this.database.reflections.get(reflection.id);
      return repositories(this.database).reflections.save({
        ...reflection,
        createdAt: old?.createdAt || reflection.createdAt,
      });
    });
  }
}
export const reflectionService = new ReflectionService();
