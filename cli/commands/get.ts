import { Command } from "@cliffy/command";
import { db as coreDb } from "../../lib/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";

/**
 * Command to get a value from a database.
 */
// deno-lint-ignore no-explicit-any
export const get: Command<any> = new Command()
  .description("Get a value from a database")
  .arguments("<slug:string> <path:string>")
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

      const targetPath = resolvePath([], path);
      const res = await kv.get(targetPath as Deno.KvKey);

      if (res.versionstamp) {
        console.log(res.value);
      }
      // Else output nothing, consistent with repl

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
