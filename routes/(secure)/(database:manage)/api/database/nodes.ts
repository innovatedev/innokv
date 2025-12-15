import { define } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/lib/db.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { DbNode } from "@/lib/types.ts";

const db = new DatabaseRepository(kvdex);

export const handler = define.handlers({
  GET: async (ctx) => {
    return db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");
      if (!dbId) throw new Error("Database ID is required");

      const parentPathStr = ctx.url.searchParams.get("parentPath");
      const parentPath = parentPathStr ? KeyCodec.decode(parentPathStr) : [];

      const cursor = ctx.url.searchParams.get("cursor") || undefined;
      const limit = parseInt(ctx.url.searchParams.get("limit") || "100");

      const { nodes, cursor: nextCursor } = await db.getNodes(
        dbId,
        parentPath,
        { limit, cursor },
      );

      // Convert to Structure expected by Frontend (Record<string, DbNode>)
      const structure: Record<string, DbNode> = {};

      for (const node of nodes) {
        const mapKey = KeyCodec.encode([node]);
        structure[mapKey] = node;
      }

      return { items: structure, cursor: nextCursor };
    });
  },
});
