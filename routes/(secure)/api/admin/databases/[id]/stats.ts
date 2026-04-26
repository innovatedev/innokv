import { defineAuth } from "@/utils.ts";
import { DatabaseError, DatabaseRepository } from "@/lib/Database.ts";
import { db } from "@/kv/db.ts";

export const handler = defineAuth.handlers({
  async POST(ctx) {
    const id = ctx.params.id;
    const dbRepo = new DatabaseRepository(db);

    // Ensure user has permission to manage databases
    ctx.state.plugins.permissions.requires("database:manage");

    try {
      const body = await ctx.req.json().catch(() => ({}));
      const pathInfo = body.pathInfo;
      const stats = await dbRepo.getDatabaseStats(
        id,
        pathInfo,
        ctx.state.userId,
      );
      return Response.json({ ok: true, stats });
    } catch (err) {
      if (!(err instanceof DatabaseError)) {
        console.error(`Failed to refresh stats for database ${id}:`, err);
      }
      return Response.json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }, { status: 500 });
    }
  },
});
