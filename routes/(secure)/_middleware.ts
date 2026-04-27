import { db } from "@/kv/db.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { hasPermission } from "@/lib/permissions.ts";
import { define } from "@/utils.ts";
import { authOnlyMiddleware } from "@innovatedev/fresh-session";
import { HttpError } from "fresh";

export const handler = define.middleware([
  authOnlyMiddleware("/login"),
  async (ctx) => {
    // Initialize state plugins
    ctx.state.plugins = ctx.state.plugins || {
      kvAdmin: { databases: [] },
      permissions: {
        has: () => false,
        requires: () => {},
      },
    };

    // Permissions Plugin
    ctx.state.plugins.permissions = {
      has: (permission: string) =>
        hasPermission(ctx.state.user?.permissions || [], permission),
      requires: (permission: string) => {
        if (!hasPermission(ctx.state.user?.permissions || [], permission)) {
          throw new HttpError(403, "Forbidden");
        }
      },
    };

    // Ensure userId is set for SecureState compatibility
    if (ctx.state.user && !ctx.state.userId) {
      ctx.state.userId = ctx.state.user.id;
    }

    if (ctx.state.plugins.permissions.has(`database:read`)) {
      const repo = new DatabaseRepository(db);

      // Load databases
      const fetchResult = await repo.getDatabases({
        reverse: false,
        limit: 100,
      });

      // deno-lint-ignore no-explicit-any
      const databases = fetchResult.result.map((doc: any) => doc.flat()).sort(
        // deno-lint-ignore no-explicit-any
        (a: any, b: any) => {
          // Treat 0 as "end of list" / Infinity
          const valA = a.sort === 0 || !a.sort
            ? Number.MAX_SAFE_INTEGER
            : a.sort;
          const valB = b.sort === 0 || !b.sort
            ? Number.MAX_SAFE_INTEGER
            : b.sort;

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
            // Finally name
            return a.name.localeCompare(b.name);
          }
          return valA - valB;
        },
      );

      ctx.state.plugins.kvAdmin.databases = databases;
    }

    return await ctx.next();
  },
]);
