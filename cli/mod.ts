import { Command } from "@cliffy/command";
import { repl } from "./commands/repl.ts";
import { db } from "./commands/db.ts";
import { ls } from "./commands/ls.ts";
import { get } from "./commands/get.ts";

const cmd = new Command()
  .name("innokv")
  .version("0.0.1")
  .description("InnoKV Command Line Interface")
  .action(() => {
    console.log(
      "Welcome to InnoKV CLI! Use --help for usage instructions, or 'repl' to enter interactive mode.",
    );
  })
  .command("repl", repl)
  .command("db", db)
  .command("ls", ls)
  .command("get", get);

if (import.meta.main) {
  await cmd.parse(Deno.args);
}
