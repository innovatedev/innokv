import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");
      const query = ctx.url.searchParams.get("query");

      if (!dbId) throw new Error("Database ID is required");
      if (query === null) throw new Error("Query is required");

      ctx.state.plugins.permissions.requires(`database:read:${dbId}`);

      const target = (ctx.url.searchParams.get("target") || "all") as
        | "key"
        | "value"
        | "all";
      const pathInfo = ctx.url.searchParams.get("pathInfo") || "";
      const recursive = ctx.url.searchParams.get("recursive") !== "false";
      const regex = ctx.url.searchParams.get("regex") === "true";
      const caseSensitive =
        ctx.url.searchParams.get("caseSensitive") === "true";
      const limit = parseInt(ctx.url.searchParams.get("limit") || "50");
      const cursor = ctx.url.searchParams.get("cursor") || undefined;

      return await db.searchRecords(dbId, {
        query,
        target,
        pathInfo,
        recursive,
        regex,
        caseSensitive,
        limit,
        cursor,
      });
    }),
});
