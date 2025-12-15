import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import { state } from "../state.ts";
import { DatabaseRepository } from "../../lib/Database.ts";
import { db as coreDb } from "../../lib/db.ts";
import { resolvePath } from "../utils.ts";

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

    const args = cmdLine.trim().split(" ");
    const cmd = args[0];

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
        const displayTargetPath = "/" + targetPath.map((p) => {
          if (typeof p === "string") return `"${p}"`;
          if (typeof p === "bigint") return `${p}n`;
          if (p instanceof Uint8Array) return `u8[${p.join(",")}]`;
          return String(p);
        }).join("/");

        console.log("Listing keys in path:", displayTargetPath);

        const iter = state.kv.list({ prefix: targetPath as Deno.KvKey });

        const seenKeys = new Set<string>();

        for await (const entry of iter) {
          const remainingKey = entry.key.slice(targetPath.length);
          if (remainingKey.length > 0) {
            const nextPart = remainingKey[0];

            // Encode for display using KeyCodec logic (mimicked)
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
      } else if (cmd === "cd") {
        state.currentPath = resolvePath(state.currentPath, args[1]);
      } else if (cmd === "get") {
        if (!state.kv) {
          console.log("No database connected.");
          continue;
        }

        const targetPath = resolvePath(state.currentPath, args[1]);

        // Get current path's value
        const res = await state.kv.get(targetPath as Deno.KvKey);
        if (res.versionstamp) {
          console.log(res.value);
        }
      } else if (cmd === "help") {
        console.log(
          "Available commands: exit, help, use <slug>, ls <path>, cd <path>, get <path> (show value of key)",
        );
      } else if (cmd.trim() !== "") {
        console.log(`Unknown command: ${cmd}`);
      }
    } catch (e: unknown) {
      console.error("Error:", e instanceof Error ? e.message : String(e));
    }
  }
}

export const repl = new Command()
  .description("Start the interactive InnoKV shell")
  .arguments("[slug:string]")
  .action(async (_options, slug) => {
    await startRepl(slug);
  });
