import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { state } from "../state.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { db as coreDb } from "@/kv/db.ts";
import { startRepl } from "./repl.ts";
import { resolvePath } from "../utils.ts";

import {
  doGet,
  doLs,
  doSet,
  doUpdate,
  ensureAuthenticated,
} from "../actions.ts";

/**
 * Command to manage databases (list or connect).
 */
// deno-lint-ignore no-explicit-any
export const db: Command<any> = new Command()
  .description(
    "Manage databases. Default: List databases. With arg: Connect to database.",
  )
  .arguments("[slug:string] [command:string] [...args:string]")
  .action(async (_options, slug, command, ...args) => {
    try {
      await ensureAuthenticated();

      if (slug) {
        if (command) {
          // Run a one-off command
          await runOneOffCommand(slug, command, args);
        } else {
          // Connect to the specified database
          await startRepl(slug);
        }
      } else {
        // No database specified, so list them
        await listDatabases();
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  });

async function runOneOffCommand(slug: string, command: string, args: string[]) {
  const repo = new DatabaseRepository(coreDb);
  try {
    const dbDoc = await repo.getDatabaseBySlugOrId(slug);
    const db = { ...dbDoc.value, id: dbDoc.id };
    const kv = await repo.connectDatabase(db);

    if (command === "ls") {
      const targetPath = resolvePath([], args[0]);
      await doLs(kv, slug, targetPath);
    } else if (command === "get") {
      const targetPath = resolvePath([], args[0]);
      await doGet(kv, slug, targetPath);
    } else if (command === "set") {
      const targetPath = resolvePath([], args[0]);
      await doSet(kv, slug, targetPath, args[1]);
      console.log(`Successfully set value at ${args[0]}`);
    } else if (command === "update") {
      const targetPath = resolvePath([], args[0]);
      const mergeArrays = args.includes("--merge-arrays");
      await doUpdate(kv, slug, targetPath, args[1], { mergeArrays });
      console.log(`Successfully updated value at ${args[0]}`);
    } else {
      console.error(`Unknown command: ${command}`);
      Deno.exit(1);
    }

    kv.close();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    Deno.exit(1);
  }
}

async function listDatabases() {
  // Init repo if needed
  if (!state.repo) {
    state.repo = new DatabaseRepository(coreDb);
  }

  console.log("Fetching databases...");
  const dbs = await state.repo.getDatabases();

  const table = new Table()
    .header(["ID", "Slug", "Name", "Type", "Path"])
    .body(
      // deno-lint-ignore no-explicit-any
      dbs.result.map((d: any) => [
        d.id,
        d.value.slug,
        d.value.name,
        d.value.type,
        d.value.path || "N/A",
      ]),
    )
    .border(true);

  console.log(table.toString());
}
