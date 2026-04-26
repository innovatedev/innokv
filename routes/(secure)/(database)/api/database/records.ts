import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";
import { ApiKvKeyPart } from "@/lib/types.ts";

import { RichValue } from "@/lib/ValueCodec.ts";

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

      // Handle Export
      if (ctx.url.searchParams.has("export")) {
        const recursive = ctx.url.searchParams.get("recursive") === "true";
        const all = ctx.url.searchParams.get("all") === "true";
        const wireKeys = ctx.url.searchParams.get("keys");
        let keys: Deno.KvKey[] | undefined;

        if (wireKeys) {
          const parsed = JSON.parse(wireKeys);
          keys = (parsed as ApiKvKeyPart[][]).map((k) =>
            k.map((p) => db.parseKeyPart(p))
          );
        }

        return db.exportRecords(database.id, {
          pathInfo,
          recursive,
          all,
          keys,
        });
      }

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
  PATCH: (ctx) =>
    db.handleApiCall(ctx, async (rawData) => {
      const data = rawData as {
        id: string;
        oldPath?: string;
        keys?: ApiKvKeyPart[][];
        newPath: string;
        recursive?: boolean;
        targetId?: string;
        mode?: "move" | "copy";
        sourcePath?: string;
      };
      const {
        id,
        oldPath,
        newPath,
        recursive,
        targetId,
        mode,
        keys: wireKeys,
        sourcePath,
      } = data;
      if (
        !id || newPath === undefined || (oldPath === undefined && !wireKeys)
      ) {
        throw new Error(
          "Missing required fields (id, newPath, and either oldPath or keys)",
        );
      }
      ctx.state.plugins.permissions.requires(`database:write:${id}`);
      if (targetId && targetId !== id) {
        ctx.state.plugins.permissions.requires(`database:write:${targetId}`);
      }

      let keys: Deno.KvKey[] | undefined;
      if (wireKeys) {
        keys = (wireKeys as ApiKvKeyPart[][]).map((k) =>
          k.map((p) => db.parseKeyPart(p))
        );
      }

      const options = {
        oldPath,
        keys,
        newPath,
        recursive,
        targetId,
        sourcePath,
      };

      if (mode === "copy") {
        return await db.copyRecords(id, options);
      }
      return await db.moveRecords(id, options);
    }),
  PUT: (ctx) =>
    db.handleApiCall(ctx, async (rawData) => {
      const data = rawData as {
        id: string;
        entries: { key: ApiKvKeyPart[]; value: RichValue }[];
      };
      const { id, entries } = data;
      if (!id || !entries) throw new Error("Missing required fields");
      ctx.state.plugins.permissions.requires(`database:write:${id}`);
      return await db.importRecords(id, entries);
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
