/// <reference lib="deno.unstable" />
import { App, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "./config/session.ts";
import { performFirstBootCheck } from "@/lib/first-boot-check.ts";
import { cmd } from "@/cli/mod.ts";

// CLI Handler
if (Deno.args.length > 0) {
  await cmd.parse(Deno.args);
  Deno.exit(0);
}

// First-boot check
await performFirstBootCheck();

export const app = new App<State>();

app.use(staticFiles());

app.use(session);

// Include file-system based routes here
app.fsRoutes();
