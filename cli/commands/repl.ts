import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import { state } from "../state.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { db as coreDb } from "@/kv/db.ts";
import { resolvePath } from "../utils.ts";
import { doGet, doLs, doSet, doUpdate } from "../actions.ts";

export async function startRepl(initialSlug?: string) {
  // If initial slug provided, try to connect immediately
  if (initialSlug) {
    if (!state.repo) state.repo = new DatabaseRepository(coreDb);
    try {
      const dbDoc = await state.repo.getDatabaseBySlugOrId(initialSlug);
      const db = { ...dbDoc.value, id: dbDoc.id };
      state.currentDbId = db.id;
      state.currentDbName = db.slug;
      state.currentPath = [];
      // deno-lint-ignore no-explicit-any
      state.kv = await state.repo.connectDatabase(db as any);
      console.log(`Switched to database: ${db.name} (${db.slug})`);
    } catch (e: unknown) {
      console.error(
        "Failed to connect to initial database:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  console.log("Starting InnoKV REPL...");
  console.log("Type 'help' for commands, 'exit' to quit.");

  while (true) {
    const displayPath = "/" + state.currentPath.map((p) => {
      if (typeof p === "string") return `"${p}"`;
      if (typeof p === "bigint") return `${p}n`;
      if (p instanceof Uint8Array) return `u8[${p.join(",")}]`;
      return String(p);
    }).join("/");

    const cmdLine = await Input.prompt({
      message: `innokv:${state.currentDbName || "none"} ${displayPath}>`,
      minLength: 0,
    });

    const args = parseArgs(cmdLine.trim());
    const cmd = args[0];

    if (!cmd) continue;
    if (cmd === "exit") break;

    try {
      if (cmd === "use") {
        const slug = args[1];
        if (!slug) {
          console.log("Usage: use <db-slug>");
          continue;
        }

        // Init repo if needed
        if (!state.repo) state.repo = new DatabaseRepository(coreDb);

        try {
          const dbDoc = await state.repo.getDatabaseBySlugOrId(slug);
          const db = { ...dbDoc.value, id: dbDoc.id };

          state.currentDbId = db.id;
          state.currentDbName = db.slug;
          state.currentPath = [];
          // Connect to this specific DB
          // deno-lint-ignore no-explicit-any
          state.kv = await state.repo.connectDatabase(db as any);
          console.log(`Switched to database: ${db.name} (${db.slug})`);
        } catch (e: unknown) {
          console.error(
            "Failed to connect:",
            e instanceof Error ? e.message : String(e),
          );
        }
      } else if (cmd === "ls") {
        if (!state.kv || !state.currentDbId) {
          console.log("No database selected. Type 'use <slug>' first.");
          continue;
        }

        const targetPath = resolvePath(state.currentPath, args[1]);
        await doLs(state.kv, state.currentDbName!, targetPath);
      } else if (cmd === "cd") {
        state.currentPath = resolvePath(state.currentPath, args[1]);
      } else if (cmd === "get") {
        if (!state.kv) {
          console.log("No database connected.");
          continue;
        }
        const targetPath = resolvePath(state.currentPath, args[1]);
        await doGet(state.kv, state.currentDbName!, targetPath);
      } else if (cmd === "set") {
        if (!state.kv) {
          console.log("No database connected.");
          continue;
        }
        const targetPath = resolvePath(state.currentPath, args[1]);
        await doSet(state.kv, state.currentDbName!, targetPath, args[2]);
        console.log("Value set successfully.");
      } else if (cmd === "update") {
        if (!state.kv) {
          console.log("No database connected.");
          continue;
        }
        const targetPath = resolvePath(state.currentPath, args[1]);
        const mergeArrays = args.includes("--merge-arrays");
        await doUpdate(state.kv, state.currentDbName!, targetPath, args[2], {
          mergeArrays,
        });
        console.log("Value updated successfully.");
      } else if (cmd === "help") {
        console.log(
          "Available commands: exit, help, use <slug>, ls <path>, cd <path>, get <path>, set <path> <value>, update <path> <value>",
        );
      } else {
        console.log(`Unknown command: ${cmd}`);
      }
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
    }
  }
}

/**
 * Simple argument parser that handles double quotes.
 */
function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

type ReplArgs = [string | undefined];

/**
 * Command to start the interactive InnoKV shell.
 */
// deno-lint-ignore no-explicit-any
export const repl: Command<any> = new Command()
  .description("Start the interactive InnoKV shell")
  .arguments("[slug:string]")
  .action(async (_options, slug) => {
    await startRepl(slug);
  });
