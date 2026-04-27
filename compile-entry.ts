/**
 * Custom compiled entry point for InnoKV.
 *
 * This file is the entrypoint used by `deno compile`. It routes all invocations
 * through the CLI parser. The CLI's default action (no args) and the `serve`
 * subcommand both start the web server; all other subcommands work as CLI tools.
 *
 * Usage:
 *   innokv              → starts the server (default action)
 *   innokv serve        → starts the server
 *   innokv --help       → shows CLI help
 *   innokv <command>    → runs the CLI command
 */
import { cmd } from "./cli/mod.ts";

await cmd.parse(Deno.args);
