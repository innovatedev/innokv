import { App, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "@/config/session.ts";

// CLI Handler - Use dynamic import to avoid Vite/SSR analysis of CLI dependencies
if (import.meta.main) {
  if (
    Deno.args.length > 0 && (Deno.args[0] === "dev" || Deno.args[0] === "build")
  ) {
    // Let Fresh handle dev/build
  } else {
    const { cmd } = await import("./cli/mod.ts");
    await cmd.parse(Deno.args);
    // Don't Deno.exit(0) here as the server might be running
  }
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
