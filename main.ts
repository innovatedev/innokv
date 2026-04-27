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
    const command = new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", `jsr:@innovatedev/innokv@${APP_VERSION}`],
    });
    const { stdout } = await command.output();
    const info = JSON.parse(new TextDecoder().decode(stdout));
    // Try to find the local path for the entry point
    packageRoot = info.modules?.[0]?.local || null;
    return packageRoot;
  } catch (e) {
    console.error("[InnoKV] Failed to resolve package root:", e);
    return null;
  }
}

app.use(async (ctx) => {
  const { pathname } = ctx.url;
  const root = await getPackageRoot();
  
  const isJsr = import.meta.url.startsWith("jsr:");
  if (!isJsr) return ctx.next();

  const { join, fromFileUrl } = await import("@std/path");
  let baseDir = root && root.startsWith("file:") ? fromFileUrl(root) : root;
  if (baseDir && (baseDir.endsWith(".ts") || baseDir.endsWith(".js") || baseDir.endsWith(".mjs"))) {
    baseDir = join(baseDir, "..", "..");
  }

  // 1. Handle compiled assets (_fresh/client/assets)
  if (pathname.startsWith("/assets/")) {
    // Try local file first (Offline)
    if (baseDir) {
      try {
        const filePath = join(baseDir, "_fresh", "client", pathname);
        const content = await Deno.readFile(filePath);
        const contentType = pathname.endsWith(".css") ? "text/css" : "text/javascript";
        return new Response(content, { headers: { "content-type": contentType } });
      } catch { /* fallback to HTTPS */ }
    }

    // Fallback to HTTPS (Online)
    const jsrUrl = `https://jsr.io/@innovatedev/innokv/${APP_VERSION}/_fresh/client${pathname}`;
    try {
      const resp = await fetch(jsrUrl);
      if (resp.ok) return resp;
    } catch { /* fallback */ }
  }

  // 2. Handle static files (static/*)
  const staticFiles = ["/favicon.ico", "/logo.png", "/logo.svg"];
  if (staticFiles.includes(pathname)) {
    if (baseDir) {
      try {
        const filePath = join(baseDir, "static", pathname);
        const content = await Deno.readFile(filePath);
        return new Response(content);
      } catch { /* fallback to HTTPS */ }
    }

    const jsrUrl = `https://jsr.io/@innovatedev/innokv/${APP_VERSION}/static${pathname}`;
    try {
      const resp = await fetch(jsrUrl);
      if (resp.ok) return resp;
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
