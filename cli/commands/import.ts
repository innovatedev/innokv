import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { doImport } from "../actions.ts";

/**
 * Command to import records into a database.
 */
// deno-lint-ignore no-explicit-any
export const importCmd: Command<any> = new Command()
  .description("Import records into a database from a JSON file or STDIN")
  .arguments("<slug:string> [inputFile:string]")
  .action(async (_options, slug, inputFile) => {
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

      let content = "";
      if (inputFile) {
        content = await Deno.readTextFile(inputFile);
      } else {
        // Read from STDIN
        const decoder = new TextDecoder();
        for await (const chunk of Deno.stdin.readable) {
          content += decoder.decode(chunk);
        }
      }

      if (!content.trim()) {
        throw new Error("No import data provided.");
      }

      const entries = JSON.parse(content);
      await doImport(kv, slug, entries);

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
