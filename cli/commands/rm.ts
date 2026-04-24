import { Command } from "@cliffy/command";
import { Confirm } from "@cliffy/prompt";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";

/**
 * Command to remove (delete) records from a database.
 */
// deno-lint-ignore no-explicit-any
export const rm: Command<any> = new Command()
  .description("Remove records from a database")
  .arguments("<slug:string> <path:string>")
  .option("-r, --recursive", "Remove records recursively")
  .option("-f, --force", "Do not prompt for confirmation")
  .option("-i, --interactive", "Prompt before every removal")
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

      const targetPath = resolvePath([], path);

      if (options.recursive) {
        if (options.interactive) {
          // Interactive per-record delete
          const records = await repo.getRecords(slug, path, undefined, 1000, {
            recursive: true,
          });
          console.log(`Found ${records.records.length} records to remove.`);

          for (const record of records.records) {
            const keyStr = JSON.stringify(record.key.map((k) => k.value));
            const confirmed = await Confirm.prompt({
              message: `Remove record: ${keyStr}?`,
              default: false,
            });
            if (confirmed) {
              const key = record.key.map((p) => repo.parseKeyPart(p));
              await repo.deleteRecord(slug, key);
              console.log(`  Removed ${keyStr}`);
            }
          }
        } else {
          // Bulk delete with single confirmation
          if (!options.force) {
            const records = await repo.getRecords(slug, path, undefined, 1000, {
              recursive: true,
            });
            const count = records.records.length;
            if (count === 0) {
              console.log(`No records found under path "${path}".`);
              Deno.exit(0);
            }

            const confirmed = await Confirm.prompt({
              message:
                `Recursively remove all ${count} records under path "${path}"?`,
              default: false,
            });
            if (!confirmed) {
              console.log("Aborted.");
              Deno.exit(0);
            }
          }

          const result = await repo.deleteRecords(slug, {
            pathInfo: path,
            recursive: true,
            all: true,
          });
          if (result.ok) {
            console.log(`Successfully removed path ${path} recursively`);
          }
        }
      } else {
        // Single record delete
        if (!options.force) {
          const confirmed = await Confirm.prompt({
            message: `Remove key "${path}"?`,
            default: false,
          });
          if (!confirmed) {
            console.log("Aborted.");
            Deno.exit(0);
          }
        }
        await repo.deleteRecord(slug, targetPath as Deno.KvKey);
        console.log(`Successfully removed key ${path}`);
      }

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
