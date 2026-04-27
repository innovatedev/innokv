import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";
import { AuthState } from "@/utils.ts";
import { Database } from "@/kv/models.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  POST: (ctx) =>
    db.handleApiCall(ctx, (data) => db.addDatabase(data as Database)),
  PUT: (ctx) =>
    db.handleApiCall(ctx, (data) => {
      const d = data as { id: string } & Partial<Database>;
      return db.updateDatabase(d.id, d);
    }),
  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (data) => {
      const result = await db.deleteDatabase(data as string);
      if (result.ok && result.name) {
        (ctx.state as AuthState).flash(
          "success",
          `Database "${result.name}" deleted`,
        );
      }
      return result;
    }),
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const lookup = await db.getDatabases({ reverse: false, limit: 100 });
      // deno-lint-ignore no-explicit-any
      const sortedData = lookup.result.map((doc: any) => doc.flat()).sort(
        // deno-lint-ignore no-explicit-any
        (a: any, b: any) => {
          // Treat 0 as "end of list" / Infinity
          const valA = a.sort === 0 || !a.sort
            ? Number.MAX_SAFE_INTEGER
            : a.sort;
          const valB = b.sort === 0 || !b.sort
            ? Number.MAX_SAFE_INTEGER
            : b.sort;

          if (valA === valB) {
            // Tie-break with lastAccessedAt descending (Newer first)
            if (a.lastAccessedAt && b.lastAccessedAt) {
              return new Date(b.lastAccessedAt).getTime() -
                new Date(a.lastAccessedAt).getTime();
            } else if (a.lastAccessedAt) {
              return -1; // a has access time, comes first
            } else if (b.lastAccessedAt) {
              return 1; // b has access time, comes first
            }
            return 0;
          }
          return valA - valB; // Ascending Rank (1 < 10)
        },
      );

      return {
        cursor: lookup.cursor,
        data: sortedData,
      };
    }),
});
