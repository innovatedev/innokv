import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadGlobalConfig } from "@/lib/config-loader.ts";
import settings from "@/config/app.ts";
import { db } from "@/kv/db.ts";

Deno.test("loadGlobalConfig - should apply KV config", async () => {
  // Setup: save a config in KV
  await db.config.delete("global");
  await db.config.set("global", {
    port: 9999,
    cookieName: "test_cookie",
    updatedAt: new Date(),
  });

  // Execute
  await loadGlobalConfig();

  // Verify
  assertEquals(settings.server.port, 9999);
  assertEquals(settings.server.cookieName, "test_cookie");

  // Cleanup
  await db.config.delete("global");
});

Deno.test("loadGlobalConfig - overrides should take precedence", async () => {
  // Setup: save a config in KV
  await db.config.delete("global");
  await db.config.set("global", {
    port: 9999,
    cookieName: "test_cookie",
    updatedAt: new Date(),
  });

  // Execute with overrides
  await loadGlobalConfig({ port: 8888, cookieName: "override_cookie" });

  // Verify
  assertEquals(settings.server.port, 8888);
  assertEquals(settings.server.cookieName, "override_cookie");

  // Cleanup
  await db.config.delete("global");
});
