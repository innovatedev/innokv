import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doExport } from "../actions.ts";

/**
 * Command to export records from a database.
 */
// deno-lint-ignore no-explicit-any
export const exportCmd: Command<any> = new Command()
  .description("Export records from a database to a JSON file or STDOUT")
  .arguments("<slug:string> [path:string]")
  .option("-o, --output <file:string>", "Output file path (defaults to STDOUT)")
  .option("-r, --recursive", "Export records recursively", { default: true })
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
      const entries = await doExport(kv, slug, targetPath, options.recursive);

      const json = JSON.stringify(entries, null, 2);
      if (options.output) {
        await Deno.writeTextFile(options.output, json);
        console.log(
          `Successfully exported ${entries.length} records to ${options.output}`,
        );
      } else {
        console.log(json);
      }

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
