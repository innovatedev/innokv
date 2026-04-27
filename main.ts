import { App, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "@/config/session.ts";

export const app = new App<State>();

// JSR Asset Bridge: Fresh 2.0's default asset serving uses Deno.open with relative paths,
// which fails when running from the JSR cache. We intercept these requests and
// serve them using Deno's fetch() which correctly resolves jsr: URLs.
app.use(async (ctx) => {
  const { pathname } = ctx.url;

  // 1. Handle compiled assets (_fresh/client/assets)
  if (pathname.startsWith("/assets/")) {
    const assetBase = import.meta.url.includes("_fresh")
      ? "../client"
      : "./_fresh/client";
    const assetUrl = new URL(`${assetBase}${pathname}`, import.meta.url);
    try {
      const resp = await fetch(assetUrl);
      if (resp.ok) return resp;
    } catch { /* fallback */ }
  }

  // 2. Handle static files (static/*)
  const staticFiles = ["/favicon.ico", "/logo.png", "/logo.svg"];
  if (staticFiles.includes(pathname)) {
    const staticBase = import.meta.url.includes("_fresh")
      ? "../../static"
      : "./static";
    const assetUrl = new URL(`${staticBase}${pathname}`, import.meta.url);
    try {
      const resp = await fetch(assetUrl);
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
