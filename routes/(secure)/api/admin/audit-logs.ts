import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      ctx.state.plugins.permissions.requires("admin:audit_logs");

      const userId = ctx.url.searchParams.get("userId") || undefined;
      const databaseId = ctx.url.searchParams.get("databaseId") || undefined;
      const limit = parseInt(ctx.url.searchParams.get("limit") || "50");
      const cursor = ctx.url.searchParams.get("cursor") || undefined;

      return await db.getAuditLogs({
        userId,
        databaseId,
        limit,
        cursor,
      });
    }),

  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (data: unknown) => {
      const body = data as { before?: string; databaseId?: string };
      ctx.state.plugins.permissions.requires("admin:audit_logs");

      const before = body.before ? new Date(body.before) : undefined;
      const databaseId = body.databaseId || undefined;

      return await db.purgeAuditLogs({
        before,
        databaseId,
      });
    }),
});
