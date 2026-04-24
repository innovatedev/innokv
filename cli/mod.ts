import { Command } from "@cliffy/command";
import { Confirm } from "@cliffy/prompt";
import { repl } from "./commands/repl.ts";
import { db } from "./commands/db.ts";
import { ls } from "./commands/ls.ts";
import { get } from "./commands/get.ts";
import { set } from "./commands/set.ts";
import { update } from "./commands/update.ts";
import { mv } from "./commands/mv.ts";
import { cp } from "./commands/cp.ts";
import { rm } from "./commands/rm.ts";
import { login, logout, whoami } from "./commands/auth.ts";
import { user } from "./commands/user.ts";
import { importCmd } from "./commands/import.ts";
import { exportCmd } from "./commands/export.ts";
import { tree } from "./commands/tree.ts";
import { configCmd } from "./commands/config.ts";
import { deleteConfig } from "./config.ts";
import { install } from "./commands/install.ts";
import { app } from "../main.ts";
import { APP_VERSION } from "../lib/metadata.ts";
import settings from "../config/app.ts";

// Re-export Command so it is part of the public API, fixing 'private-type-ref' errors.
export { Command } from "@cliffy/command";

/**
 * The main entry point for the InnoKV CLI.
 *
 * This command groups all subcommands (install, db, ls, get, repl) and provides
 * version and help information.
 */
// deno-lint-ignore no-explicit-any
export const cmd: Command<any> = new Command()
  .name("innokv")
  .version(APP_VERSION)
  .description("InnoKV Command Line Interface")
  .option("-p, --port <number:number>", "Port to run the server on", {
    default: 8000,
  })
  .option("--cookie-name <name:string>", "Name of the session cookie", {
    default: "innokv_session",
  })
  .action(async (options) => {
    const { performFirstBootCheck } = await import(
      "../lib/first-boot-check.ts"
    );
    const { loadGlobalConfig } = await import("../lib/config-loader.ts");

    await performFirstBootCheck();
    await loadGlobalConfig(options);

    console.log(`InnoKV Version: ${APP_VERSION}`);
    console.log(`Using Database: ${settings.db.path}`);
    console.log(`Listening on: http://localhost:${settings.server.port}`);

    await app.listen({ port: settings.server.port });
  })
  .command("repl", repl)
  .command("db", db)
  .command("ls", ls)
  .command("get", get)
  .command("set", set)
  .command("update", update)
  .command("mv", mv)
  .command("cp", cp)
  .command("rm", rm)
  .command("login", login)
  .command("logout", logout)
  .command("whoami", whoami)
  .command("user", user)
  .command("import", importCmd)
  .command("export", exportCmd)
  .command("tree", tree)
  .command("config", configCmd)
  .command(
    "serve",
    new Command()
      .description("Start the InnoKV web server")
      .option("-p, --port <number:number>", "Port to run the server on")
      .option("--cookie-name <name:string>", "Name of the session cookie")
      .action(async (options) => {
        const { performFirstBootCheck } = await import(
          "../lib/first-boot-check.ts"
        );
        const { loadGlobalConfig } = await import("../lib/config-loader.ts");

        await performFirstBootCheck();
        await loadGlobalConfig(
          options as { port?: number; cookieName?: string },
        );

        console.log(`InnoKV Version: ${APP_VERSION}`);
        console.log(`Using Database: ${settings.db.path}`);
        console.log(`Listening on: http://localhost:${settings.server.port}`);

        await app.listen({ port: settings.server.port });
      }),
  )
  .command(
    "reset",
    new Command()
      .description("Completely reset InnoKV (destroys ALL data!)")
      .action(async () => {
        const confirmed = await Confirm.prompt({
          message:
            "Are you sure you want to reset InnoKV? This will delete ALL users, databases, and settings.",
          default: false,
        });

        if (!confirmed) {
          console.log("Reset cancelled.");
          return;
        }

        console.log("Resetting InnoKV...");

        try {
          // Delete core database
          await Deno.remove(settings.db.path);
          console.log(`- Deleted database: ${settings.db.path}`);
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`- Failed to delete database: ${message}`);
          }
        }

        // Delete CLI config
        await deleteConfig();
        console.log("- Deleted local configuration.");

        console.log(
          "\n✅ InnoKV has been fully reset. Run 'innokv user add' to bootstrap a new admin.",
        );
      }),
  )
  .command("install", install);

if (import.meta.main) {
  await cmd.parse(Deno.args);
}
