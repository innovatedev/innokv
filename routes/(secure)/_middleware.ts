import { define } from "@/utils.ts";
import { db } from "@/lib/db.ts";
import { DatabaseRepository } from "@/lib/Database.ts";

import { HttpError } from "fresh";

export const handler = define.middleware(async (ctx) => {
  // Initialize state plugins
  ctx.state.plugins = ctx.state.plugins || {};
  ctx.state.plugins.kvAdmin = ctx.state.plugins.kvAdmin || {};

  const checkPermissions = (permission: string) => {
    if (
      !ctx.state.user?.permissions?.some((p) =>
        p === "*" || permission.startsWith(p)
      )
    ) {
      return false;
    }
    return true;
  };

  // CSRF Check for API methods
  if (
    ctx.url.pathname.includes("/api/") &&
    ctx.state.session?.csrf &&
    ["POST", "DELETE", "PUT", "PATCH"].includes(ctx.req.method) &&
    ctx.req.headers.get("X-CSRF-Token") !== ctx.state.session?.csrf
  ) {
    throw new HttpError(403, "Forbidden");
  }

  // Admin Permission Check
  if (!checkPermissions("admin:database")) {
    console.log(ctx.state.user, ctx.state);
    return ctx.redirect("/login");
  }

  const repo = new DatabaseRepository(db);

  // Load databases
  const fetchResult = await repo.getDatabases({ reverse: false, limit: 100 });
  let databases = fetchResult.result.map((doc) => doc.flat()).sort((a, b) => {
    // Treat 0 as "end of list" / Infinity
    const valA = a.sort === 0 || !a.sort ? Number.MAX_SAFE_INTEGER : a.sort;
    const valB = b.sort === 0 || !b.sort ? Number.MAX_SAFE_INTEGER : b.sort;

    if (valA === valB) {
      // Tie-break with lastAccessedAt descending (Newer first)
      if (a.lastAccessedAt && b.lastAccessedAt) {
        return new Date(b.lastAccessedAt).getTime() -
          new Date(a.lastAccessedAt).getTime();
      } else if (a.lastAccessedAt) {
        return -1;
      } else if (b.lastAccessedAt) {
        return 1;
      }
      return 0;
    }
    return valA - valB;
  });

  ctx.state.plugins.kvAdmin.databases = databases;

  return await ctx.next();
});
