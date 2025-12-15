import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { state } from "../state.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { db as coreDb } from "../../lib/db.ts";
import { startRepl } from "./repl.ts";

export const db = new Command()
  .description(
    "Manage databases. Default: List databases. With arg: Connect to database.",
  )
  .arguments("[slug:string]")
  .action(async (_options, slug) => {
    if (slug) {
      // Connect to the specified database (even if called "list")
      await startRepl(slug);
    } else {
      // No database specified, so list them
      await listDatabases();
    }
  });

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
