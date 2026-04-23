import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";
import { ApiKvKeyPart } from "@/lib/types.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");

      if (!dbId) {
        throw new Error("Database ID is required");
      }
      ctx.state.plugins.permissions.requires(`database:read:${dbId}`);

      const database = await db.getDatabaseBySlugOrId(dbId);
      const pathInfo = ctx.url.searchParams.get("pathInfo") || "";
      const cursor = ctx.url.searchParams.get("cursor") || undefined;
      const limit = parseInt(ctx.url.searchParams.get("limit") || "100");
      const recursiveParam = ctx.url.searchParams.get("recursive");
      const recursive = recursiveParam !== null
        ? recursiveParam === "true"
        : undefined;

      return db.getRecords(database.id, pathInfo, cursor, limit, { recursive });
    }),
  POST: (ctx) =>
    db.handleApiCall(ctx, async (rawData) => {
      const data = rawData as Record<string, unknown>;
      const { id, key: wireKey, value, versionstamp, oldKey: wireOldKey } =
        data;
      if (!id) throw new Error("Database ID is required");
      if (!wireKey) throw new Error("Key is required");
      ctx.state.plugins.permissions.requires(`database:write:${id as string}`);

      const key = (wireKey as ApiKvKeyPart[]).map((p) => db.parseKeyPart(p));
      let oldKey: Deno.KvKey | undefined;
      if (wireOldKey) {
        oldKey = (wireOldKey as ApiKvKeyPart[]).map((p) => db.parseKeyPart(p));
      }

      const database = await db.getDatabaseBySlugOrId(id as string);
      if (database.value.mode === "r") {
        throw new Error("Database is read-only");
      }
      return db.saveRecord(
        database.id,
        key,
        value,
        versionstamp as string | null,
        oldKey,
      );
    }),
  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (rawData) => {
      const data = rawData as Record<string, unknown>;
      const { id, key: wireKey, keys: wireKeys, all, pathInfo, recursive } =
        data;
      if (!id) throw new Error("Database ID is required");
      ctx.state.plugins.permissions.requires(`database:write:${id as string}`);

      const database = await db.getDatabaseBySlugOrId(id as string);
      if (database.value.mode === "r") {
        throw new Error("Database is read-only");
      }

      // Single key delete
      if (wireKey) {
        const key = (wireKey as ApiKvKeyPart[]).map((p) => db.parseKeyPart(p));
        return db.deleteRecord(database.id, key);
      }

      // Bulk delete
      let keys: Deno.KvKey[] | undefined;
      if (wireKeys) {
        keys = (wireKeys as ApiKvKeyPart[][]).map((k) =>
          k.map((p) => db.parseKeyPart(p))
        );
      }

      return db.deleteRecords(database.id, {
        keys,
        all: all as boolean | undefined,
        pathInfo: pathInfo as string | undefined,
        recursive: recursive as boolean | undefined,
      });
    }),
});
