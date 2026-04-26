import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doLs } from "../actions.ts";

/**
 * Command to list keys in a database.
 */
// deno-lint-ignore no-explicit-any
export const ls: Command<any> = new Command()
  .description("List keys in a database")
  .option("--json", "Output keys as a JSON array")
  .arguments("<slug:string> [path:string]")
  .action(async (options, slug, path) => {
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
      const keys = await doLs(kv, slug, targetPath);

      if (options.json) {
        console.log(JSON.stringify(keys, null, 2));
      } else {
        for (const key of keys) {
          console.log(key);
        }
      }

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
