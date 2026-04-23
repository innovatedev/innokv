import { assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { hasPermission, rulesToPermissions } from "./permissions.ts";

Deno.test("Permissions - Admin Wildcard", () => {
  assert(hasPermission(["*"], "database:read:test"));
  assert(hasPermission(["*"], "anything:really"));
});

Deno.test("Permissions - Exact Match", () => {
  assert(hasPermission(["database:read"], "database:read"));
  assert(hasPermission(["user:write"], "user:write"));
});

Deno.test("Permissions - Hierarchy", () => {
  // database:manage implies database:manage:test
  assert(hasPermission(["database:manage"], "database:manage:test"));
  // database:read implies database:read:123
  assert(hasPermission(["database:read"], "database:read:123"));
});

Deno.test("Permissions - Partial Match Safety", () => {
  // "data" should NOT allow "database"
  assert(!hasPermission(["data"], "database:read"));
  // "database:r" should NOT allow "database:read"
  assert(!hasPermission(["database:r"], "database:read"));
});

Deno.test("Permissions - Deny Rules Override Wildcard", () => {
  const perms = ["*", "-database:read:secret"];

  assert(hasPermission(perms, "database:write:anything"));
  assert(hasPermission(perms, "database:read:public"));

  // The deny rule should block this
  assert(!hasPermission(perms, "database:read:secret"));
});

Deno.test("Permissions - Deny Rules Override Exact Match", () => {
  const perms = ["database:read:secret", "-database:read:secret"];
  assert(!hasPermission(perms, "database:read:secret"));
});

Deno.test("Permissions - Scoped Deny", () => {
  const perms = ["*", "-database:write"];

  assert(hasPermission(perms, "database:read:any"));
  assert(!hasPermission(perms, "database:write:protected"));
});

Deno.test("rulesToPermissions - Converts deny to negative string", () => {
  const rules = [
    {
      scope: "secret",
      effect: "deny" as const,
      permissions: { read: true, write: true, manage: false },
    },
    {
      scope: "*",
      effect: "allow" as const,
      permissions: { read: true, write: false, manage: false },
    },
  ];

  const perms = rulesToPermissions(rules);
  // Should include -database:read:secret, -database:write:secret, and database:read

  assert(perms.includes("-database:read:secret"));
  assert(perms.includes("-database:write:secret"));
  assert(perms.includes("database:read"));
});
