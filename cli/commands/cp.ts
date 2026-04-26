import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doCp } from "../actions.ts";

/**
 * Command to copy records in a database.
 */
// deno-lint-ignore no-explicit-any
export const cp: Command<any> = new Command()
  .description(
    "Copy records to a new key. Use 'db:path' for cross-database copy.",
  )
  .arguments("<slug:string> <source:string> <destination:string>")
  .option("-r, --recursive", "Recursive copy", { default: false })
  .action(async (options, slug, source, destination) => {
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

      // Resolve source path
      const oldPath = resolvePath([], source);

      await doCp(kv, slug, oldPath, destination, options.recursive);

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
