import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import { MigrationMap } from "../migrations/mod.ts";

Deno.test("MigrationMap - validates correct SemVer keys", () => {
  const validMap = {
    "0.3.0": Promise.resolve({
      default: { name: "test", run: () => Promise.resolve() },
    }),
    "1.2.3-beta.1": Promise.resolve({
      default: { name: "test", run: () => Promise.resolve() },
    }),
    "10.0.0": Promise.resolve({
      default: { name: "test", run: () => Promise.resolve() },
    }),
  };

  // Should not throw
  const validated = MigrationMap.assert(validMap);
  assertEquals(Object.keys(validated).length, 3);
});

Deno.test("MigrationMap - rejects invalid SemVer keys", () => {
  const invalidKeys = [
    "v0.3.0", // Prefix 'v' not allowed
    "0.3", // Missing patch version
    "0.3.0.1", // Too many parts
    "0.4.5-bobby jo", // Spaces not allowed
    "0.4.5-!", // Special characters in prerelease limited
    "invalid", // Plain string
  ];

  for (const key of invalidKeys) {
    assertThrows(
      () => {
        MigrationMap.assert({
          [key]: Promise.resolve({
            default: { name: "test", run: () => Promise.resolve() },
          }),
        });
      },
      Error, // We expect an ArkType error
    );
  }
});

Deno.test("MigrationMap - current active migrations are valid", async () => {
  // Importing active.ts triggers validation because it uses MigrationMap.assert()
  const { default: active } = await import("../kv/migrations/active.ts");

  assertEquals(typeof active, "object");
  assertEquals(active !== null, true);
});
