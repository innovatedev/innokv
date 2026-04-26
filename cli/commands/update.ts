import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doUpdate } from "../actions.ts";

/**
 * Command to update/merge a value in a database.
 */
// deno-lint-ignore no-explicit-any
export const update: Command<any> = new Command()
  .description("Update/merge a value in a database")
  .arguments("<slug:string> <path:string> <value:string>")
  .option("--merge-arrays", "Merge arrays instead of replacing them")
  .option("--rich", "Parse value using rich ValueCodec format")
  .action(async (options, slug, path, value) => {
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
      await doUpdate(kv, slug, targetPath, value, options);
      console.log(`Successfully updated value at ${path}`);

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
