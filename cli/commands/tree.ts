import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doTree } from "../actions.ts";

/**
 * Command to display database records as a tree.
 */
// deno-lint-ignore no-explicit-any
export const tree: Command<any> = new Command()
  .description("Display database keys and record types as a visual tree")
  .arguments("<slug:string> [path:string]")
  .action(async (_options, slug, path) => {
    const repo = new DatabaseRepository(coreDb);
    try {
      const dbDoc = await repo.getDatabaseBySlugOrId(slug);
      if (!dbDoc) {
        console.error(`Database not found: ${slug}`);
        Deno.exit(1);
      }
      const db = { ...dbDoc.value, id: dbDoc.id };
      // deno-lint-ignore no-explicit-any
      const kv = await repo.connectDatabase(db as any);

      // Resolve path
      const targetPath = resolvePath([], path);
      await doTree(kv, slug, targetPath);

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
