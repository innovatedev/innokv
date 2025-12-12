import { DatabaseRepository } from "../../../lib/Database.ts";
import { db as kvdex } from "../../../lib/db.ts";
import { BaseRepository } from "../../../lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");

      if (!dbId) {
        throw new Error("Database ID is required");
      }

      const pathInfo = ctx.url.searchParams.get("pathInfo") || "[]";
      const cursor = ctx.url.searchParams.get("cursor") || undefined;

      return db.getRecords(dbId, pathInfo, cursor);
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

      return db.saveRecord(id, key, value, versionstamp, oldKey);
    }),
  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (data) => {
      const { id, key: wireKey } = data;
      if (!id) throw new Error("Database ID is required");
      if (!wireKey) throw new Error("Key is required");

      const key = wireKey.map((p: any) => db.parseKeyPart(p));
      return db.deleteRecord(id, key);
    }),
});
