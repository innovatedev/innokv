import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { Confirm, Input, Select } from "@cliffy/prompt";
import { state } from "../state.ts";
import { Database } from "../../kv/models.ts";
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
 * Command to manage databases (list, add, edit, remove or connect).
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
  })
  .command("add")
  .description("Add a new database connection")
  .option("-n, --name <name:string>", "Database name")
  .option("-s, --slug <slug:string>", "Database slug")
  .option("-t, --type <type:string>", "Database type (file, memory, remote)")
  .option("-p, --path <path:string>", "Database path or URL")
  .option("-d, --description <desc:string>", "Database description")
  .action(async (options) => {
    await ensureAuthenticated();
    const repo = new DatabaseRepository(coreDb);

    const name = options.name || await Input.prompt("Database Name:");
    const slug = options.slug || await Input.prompt({
      message: "Database Slug:",
      default: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    });
    const type = (options.type || await Select.prompt({
      message: "Database Type:",
      options: [
        { name: "Local File", value: "file" },
        { name: "In-Memory", value: "memory" },
        { name: "Remote (Deno Deploy)", value: "remote" },
      ],
    })) as "file" | "memory" | "remote";

    let path = options.path;
    if (!path && type !== "memory") {
      path = await Input.prompt(
        type === "file" ? "File Path:" : "Remote URL:",
      );
    }

    const description = options.description ||
      await Input.prompt({ message: "Description:", default: "" });

    await repo.addDatabase({
      name,
      slug,
      type,
      path: path || undefined,
      description,
      mode: "rw",
    } as Database);

    console.log(`✅ Database "${name}" (${slug}) created.`);
  })
  .command("edit <slug:string>")
  .description("Edit an existing database connection")
  .option("-n, --name <name:string>", "Database name")
  .option("-s, --new-slug <slug:string>", "New database slug")
  .option("-t, --type <type:string>", "Database type")
  .option("-p, --path <path:string>", "Database path or URL")
  .option("-d, --description <desc:string>", "Database description")
  .action(async (options, slug) => {
    await ensureAuthenticated();
    const repo = new DatabaseRepository(coreDb);
    const dbDoc = await repo.getDatabaseBySlugOrId(slug);

    const name = options.name || await Input.prompt({
      message: "Database Name:",
      default: dbDoc.value.name,
    });
    const newSlug = options.newSlug || await Input.prompt({
      message: "Database Slug:",
      default: dbDoc.value.slug,
    });
    const type = (options.type || await Select.prompt({
      message: "Database Type:",
      default: dbDoc.value.type,
      options: [
        { name: "Local File", value: "file" },
        { name: "In-Memory", value: "memory" },
        { name: "Remote (Deno Deploy)", value: "remote" },
      ],
    })) as "file" | "memory" | "remote";

    let path = options.path;
    if (!path && type !== "memory") {
      path = await Input.prompt({
        message: type === "file" ? "File Path:" : "Remote URL:",
        default: dbDoc.value.path || "",
      });
    }

    const description = options.description || await Input.prompt({
      message: "Description:",
      default: dbDoc.value.description || "",
    });

    await repo.updateDatabase(dbDoc.id, {
      name,
      slug: newSlug,
      type,
      path: path || undefined,
      description,
    });

    console.log(`✅ Database "${name}" updated.`);
  })
  .command("rm <slug:string>")
  .description("Remove a database connection")
  .option("-f, --force", "Force removal without confirmation")
  .action(async (options, slug) => {
    await ensureAuthenticated();
    const repo = new DatabaseRepository(coreDb);
    const dbDoc = await repo.getDatabaseBySlugOrId(slug);

    if (!options.force) {
      const confirmed = await Confirm.prompt(
        `Are you sure you want to remove database "${
          dbDoc.value.name || slug
        }"?`,
      );
      if (!confirmed) return;
    }

    await repo.deleteDatabase(dbDoc.id);
    console.log(`✅ Database "${dbDoc.value.name || slug}" removed.`);
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
