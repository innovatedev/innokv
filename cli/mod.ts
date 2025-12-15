import { Command } from "@cliffy/command";
import { repl } from "./commands/repl.ts";
import { db } from "./commands/db.ts";
import { ls } from "./commands/ls.ts";
import { get } from "./commands/get.ts";
import { install } from "./commands/install.ts";
import { APP_VERSION } from "../lib/metadata.ts";

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
  .action(() => {
    console.log(
      "Welcome to InnoKV CLI! Use --help for usage instructions, or 'repl' to enter interactive mode.",
    );
  })
  .command("repl", repl)
  .command("db", db)
  .command("ls", ls)
  .command("get", get)
  .command("install", install);

if (import.meta.main) {
  await cmd.parse(Deno.args);
}
