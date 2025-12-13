import { define } from "@/utils.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/lib/db.ts";
import { BaseRepository } from "@/lib/BaseRepository.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";

const db = new DatabaseRepository(kvdex);

export const handler = define.handlers({
  GET: async (ctx) => {
    return db.handleApiCall(ctx, async () => {
      const dbId = ctx.url.searchParams.get("id");
      if (!dbId) throw new Error("Database ID is required");

      const parentPathStr = ctx.url.searchParams.get("parentPath");
      const parentPath = parentPathStr ? KeyCodec.decode(parentPathStr) : [];

      const nodes = await db.getNodes(dbId, parentPath);

      // Convert to Structure expected by Frontend (Record<string, DbNode>)
      const structure: Record<string, any> = {};
      for (const node of nodes) {
        // We key by the encoded value of the PART?
        // In Database.ts getKeys:
        // const mapKey = JSON.stringify({ type: info.type, value: info.value });
        // We should replicate this for consistency with existing Frontend logic.
        const mapKey = JSON.stringify({ type: node.type, value: node.value });
        structure[mapKey] = node;
      }

      return structure;
    });
  },
});
