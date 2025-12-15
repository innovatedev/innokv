import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/lib/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";

const db = new DatabaseRepository(kvdex);

export const handler = BaseRepository.handlers({
  POST: (ctx) => db.handleApiCall(ctx, db.addDatabase),
  PUT: (ctx) => db.handleApiCall(ctx, db.updateDatabase),
  DELETE: (ctx) =>
    db.handleApiCall(ctx, async (data) => {
      const result = await db.deleteDatabase(data);
      if (result.ok && result.name) {
        (ctx.state as any).flash(
          "success",
          `Database "${result.name}" deleted`,
        );
      }
      return result;
    }),
  GET: (ctx) =>
    db.handleApiCall(ctx, async () => {
      const lookup = await db.getDatabases({ reverse: false, limit: 100 });
      const sortedData = lookup.result.map((doc) => doc.flat()).sort((a, b) => {
        // Treat 0 as "end of list" / Infinity
        const aSort = a.sort || Infinity; // If 0 or undefined, treat as Infinity? Wait, 0 is explicit.
        // If sort can be 0.
        // Logic: Non-zero numbers come first (Desc or Asc?).
        // If Rank: 1, 2, 3 ... 0.
        const valA = a.sort === 0 || !a.sort ? Number.MAX_SAFE_INTEGER : a.sort;
        const valB = b.sort === 0 || !b.sort ? Number.MAX_SAFE_INTEGER : b.sort;

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
      });

      return {
        cursor: lookup.cursor,
        data: sortedData,
      };
    }),
});

// export const handler = define.handlers({
//   GET: async () => {
//     await db.addDatabase({
//       slug: "test",
//       path: ":memory:;",
//       name: "Test",
//       description: "Test",
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       sort: 0,
//       mode: "rw",
//       type: "memory",
//     })
//     return json(await kvdex.numbers.map((doc) => doc.id));
//   }
// });
