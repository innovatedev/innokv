import { DatabaseRepository } from "../../lib/Database.ts";
import { db as kvdex } from "../../lib/db.ts";
import { BaseRepository } from "../../lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const slugOrId = ctx.url.searchParams.get("id");

      if (!slugOrId) {
        throw new Error("Database ID or Slug is required");
      }

      // Resolve param to a database ID
      const database = await db.getDatabaseBySlugOrId(slugOrId);

      // Check if path arg is present
      // getKeys optionally takes a path, but the current API only takes ID?
      // Wait, the client sends 'path' param too in getDatabase?
      const path = ctx.url.searchParams.get("path");

      // We only need to fetch structure if we are navigating folders?
      // Actually existing implementation just calls getKeys(dbId).
      // Let's stick to that but use the resolved ID.
      // Wait, does getKeys handle hierarchical path?
      // DatabaseRepository.getKeys usually takes (id: string).

      // Oh, KvAdminClient.getDatabase sends { id, path }.
      // The original code was: const lookup = (await db.getKeys(dbId));
      // It ignored 'path'. I should probably support it if getKeys supports it.
      // Let's check Database.ts for getKeys signature.

      const lookup = await db.getKeys(database.id);

      return lookup;
    }),
});
