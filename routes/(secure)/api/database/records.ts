import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/lib/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");

      if (!dbId) {
        throw new Error("Database ID is required");
      }

      const database = await db.getDatabaseBySlugOrId(dbId);
      const pathInfo = ctx.url.searchParams.get("pathInfo") || "";
      const cursor = ctx.url.searchParams.get("cursor") || undefined;
      const limit = parseInt(ctx.url.searchParams.get("limit") || "100");

      return db.getRecords(database.id, pathInfo, cursor, limit);
    }),
  POST: (ctx) =>
    db.handleApiCall(ctx, async (data) => {
      const { id, key: wireKey, value, versionstamp, oldKey: wireOldKey } =
        data;
      if (!id) throw new Error("Database ID is required");
      if (!wireKey) throw new Error("Key is required");

      const key = wireKey.map((p: any) => db.parseKeyPart(p));
      let oldKey: any[] | undefined;
      if (wireOldKey) {
        oldKey = wireOldKey.map((p: any) => db.parseKeyPart(p));
      }

      const database = await db.getDatabaseBySlugOrId(id);
      if (database.value.mode === "r") {
        throw new Error("Database is read-only");
      }
      return db.saveRecord(database.id, key, value, versionstamp, oldKey);
    }),
  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (data) => {
      const { id, key: wireKey, keys: wireKeys, all, pathInfo, recursive } =
        data;
      if (!id) throw new Error("Database ID is required");

      const database = await db.getDatabaseBySlugOrId(id);
      if (database.value.mode === "r") {
        throw new Error("Database is read-only");
      }

      // Single key delete
      if (wireKey) {
        const key = wireKey.map((p: any) => db.parseKeyPart(p));
        return db.deleteRecord(database.id, key);
      }

      // Bulk delete
      let keys: Deno.KvKey[] | undefined;
      if (wireKeys) {
        keys = wireKeys.map((k: any[]) =>
          k.map((p: any) => db.parseKeyPart(p))
        );
      }

      return db.deleteRecords(database.id, {
        keys,
        all,
        pathInfo,
        recursive,
      });
    }),
});
