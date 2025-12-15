import { Command } from "@cliffy/command";
import { db as coreDb } from "../../lib/db.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { resolvePath } from "../utils.ts";

export const ls = new Command()
  .description("List keys in a database")
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
      const kv = await repo.connectDatabase(db as any);

      // Resolve path
      const targetPath = resolvePath([], path);

      const iter = kv.list({ prefix: targetPath as Deno.KvKey });
      const seenKeys = new Set<string>();

      for await (const entry of iter) {
        const remainingKey = entry.key.slice(targetPath.length);
        if (remainingKey.length > 0) {
          const nextPart = remainingKey[0];
          let displayKey = String(nextPart);
          if (typeof nextPart === "string") displayKey = `"${nextPart}"`;
          else if (typeof nextPart === "bigint") displayKey = `${nextPart}n`;
          else if (nextPart instanceof Uint8Array) {
            displayKey = `u8[${nextPart.join(",")}]`;
          }

          if (!seenKeys.has(displayKey)) {
            console.log(displayKey);
            seenKeys.add(displayKey);
          }
        }
      }

      kv.close(); // Important to close connection? Deno Kv usually auto-manages but safe to be explicit if using openKv in loop.
      // Actually connectDatabase might return shared instance, careful with close if using in app.
      // But this is CLI one-off.
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });
