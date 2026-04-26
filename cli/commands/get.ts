import { Command } from "@cliffy/command";
import { db as coreDb } from "@/kv/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";
import { doGet } from "../actions.ts";
import { ValueCodec } from "../../lib/ValueCodec.ts";

/**
 * Command to get a value from a database.
 */
// deno-lint-ignore no-explicit-any
export const get: Command<any> = new Command()
  .description("Get a value from a database")
  .option("--json", "Output the full entry as JSON")
  .option("--rich", "Output the value in rich ValueCodec format")
  .arguments("<slug:string> <path:string>")
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
      const res = await doGet(kv, slug, targetPath);

      if (res.versionstamp === null) {
        Deno.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({
          key: res.key,
          value: ValueCodec.encode(res.value),
          versionstamp: res.versionstamp,
        }, null, 2));
      } else if (options.rich) {
        console.log(JSON.stringify(ValueCodec.encode(res.value), null, 2));
      } else {
        // Human readable
        if (typeof res.value === "bigint") {
          console.log(`${res.value}n`);
        } else if (res.value instanceof Uint8Array) {
          console.log(`u8[${Array.from(res.value).join(",")}]`);
        } else if (typeof res.value === "object" && res.value !== null) {
          console.log(JSON.stringify(res.value, null, 2));
        } else {
          console.log(res.value);
        }
      }

      kv.close();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
