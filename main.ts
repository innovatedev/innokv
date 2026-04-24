/// <reference lib="deno.unstable" />
import { App, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "@/config/session.ts";
import { performFirstBootCheck } from "@/lib/first-boot-check.ts";
import { APP_VERSION } from "@/lib/metadata.ts";
import settings from "@/config/app.ts";

// CLI Handler - Use dynamic import to avoid Vite/SSR analysis of CLI dependencies
if (
  import.meta.main &&
  Deno.args.length > 0 && Deno.args[0] !== "dev" && Deno.args[0] !== "build"
) {
  const { cmd } = await import("./cli/mod.ts");
  await cmd.parse(Deno.args);
  Deno.exit(0);
}

export const app = new App<State>();

app.use(staticFiles());
const csrfMiddleware = csrf();
app.use(async (ctx) => {
  if (ctx.req.headers.has("Authorization")) {
    return ctx.next();
  }
  // deno-lint-ignore no-explicit-any
  return await csrfMiddleware(ctx as any);
});
app.use(session);
app.fsRoutes();

if (import.meta.main) {
  await performFirstBootCheck();
  console.log(`InnoKV Version: ${APP_VERSION}`);
  console.log(`Using Database: ${settings.db.path}`);
  await app.listen();
}
