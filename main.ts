import { App, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "@/config/session.ts";
import { APP_VERSION } from "@/lib/metadata.ts";

export const app = new App<State>();

// JSR Asset Bridge: Fresh 2.0's default asset serving uses Deno.open with relative paths,
// which fails when running from the JSR cache (jsr: scheme). We intercept these requests
// and serve them from the local Deno cache.
let packageRoot: string | null = null;

async function getPackageRoot() {
  if (packageRoot) return packageRoot;
  const isJsr = import.meta.url.startsWith("jsr:");
  if (!isJsr) return null;

  try {
    // We use deno info to find where this package is cached locally
    const command = new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", `jsr:@innovatedev/innokv@${APP_VERSION}`],
    });
    const { stdout } = await command.output();
    const info = JSON.parse(new TextDecoder().decode(stdout));
    // The registry search finds the local directory for JSR packages
    packageRoot = info.modules?.[0]?.local || null;
    return packageRoot;
  } catch {
    return null;
  }
}

app.use(async (ctx) => {
  const { pathname } = ctx.url;
  const root = await getPackageRoot();
  if (!root) return ctx.next();

  const { join, fromFileUrl } = await import("@std/path");
  let baseDir = root.startsWith("file:") ? fromFileUrl(root) : root;
  if (baseDir.endsWith(".ts") || baseDir.endsWith(".js") || baseDir.endsWith(".mjs")) {
    baseDir = join(baseDir, "..", ".."); // entry is in /cli/mod.ts, we want /
  }

  // 1. Handle compiled assets (_fresh/client/assets)
  if (pathname.startsWith("/assets/")) {
    try {
      const filePath = join(baseDir, "_fresh", "client", pathname);
      const content = await Deno.readFile(filePath);
      const contentType = pathname.endsWith(".css")
        ? "text/css"
        : pathname.endsWith(".js")
        ? "text/javascript"
        : "application/octet-stream";
      return new Response(content, { headers: { "content-type": contentType } });
    } catch { /* fallback */ }
  }

  // 2. Handle static files (static/*)
  const staticFiles = ["/favicon.ico", "/logo.png", "/logo.svg"];
  if (staticFiles.includes(pathname)) {
    try {
      const filePath = join(baseDir, "static", pathname);
      const content = await Deno.readFile(filePath);
      return new Response(content);
    } catch { /* fallback */ }
  }

  return ctx.next();
});

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
