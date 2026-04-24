import { assertEquals } from "jsr:@std/assert@1";
import { DatabaseRepository } from "../lib/Database.ts";
import { collection, kvdex } from "@olli/kvdex";
import { DatabaseModel } from "@/kv/models.ts";
import { KeyCodec } from "../lib/KeyCodec.ts";

// Mock KV for testing
const testKv = await Deno.openKv(":memory:");

// Mock DB schema
const mockDb = kvdex({
  kv: testKv,
  schema: {
    databases: collection(DatabaseModel),
  },
});

class TestDatabaseRepository extends DatabaseRepository {
  constructor() {
    // deno-lint-ignore no-explicit-any
    super(mockDb as any);
  }

  // deno-lint-ignore no-explicit-any
  override async connectDatabase(_info: any) {
    return await Promise.resolve(testKv);
  }

  override async getDatabaseBySlugOrId(_id: string) {
    return await Promise.resolve({
      flat: () => ({ id: "test", type: "memory" }),
      id: "test",
      value: { id: "test", type: "memory" },
      // deno-lint-ignore no-explicit-any
    } as any);
  }
}

Deno.test("Recursive Operations - Move", async (t) => {
  const repo = new TestDatabaseRepository();

  async function setup() {
    // Clear all
    const iter = testKv.list({ prefix: [] });
    for await (const entry of iter) await testKv.delete(entry.key);

    // Setup:
    // users/alice -> "Alice"
    // users/alice/settings -> { theme: "dark" }
    // users/bob -> "Bob"
    await testKv.set(["users", "alice"], "Alice");
    await testKv.set(["users", "alice", "settings"], { theme: "dark" });
    await testKv.set(["users", "bob"], "Bob");
  }

  await t.step(
    "Recursive Move prefix 'users/alice' to 'archive/alice'",
    async () => {
      await setup();

      const oldPath = KeyCodec.encode([
        { type: "string", value: "users" },
        { type: "string", value: "alice" },
      ]);
      const newPath = KeyCodec.encode([
        { type: "string", value: "archive" },
        { type: "string", value: "alice" },
      ]);

      await repo.moveRecords("test-db", oldPath, newPath, true);

      // Verify old keys are gone
      assertEquals((await testKv.get(["users", "alice"])).value, null);
      assertEquals(
        (await testKv.get(["users", "alice", "settings"])).value,
        null,
      );

      // Verify new keys exist
      assertEquals((await testKv.get(["archive", "alice"])).value, "Alice");
      assertEquals(
        (await testKv.get(["archive", "alice", "settings"])).value,
        { theme: "dark" },
      );

      // Verify Bob is still there
      assertEquals((await testKv.get(["users", "bob"])).value, "Bob");
    },
  );

  await t.step("Shallow Move prefix 'users' to 'customers'", async () => {
    await setup();

    const oldPath = KeyCodec.encode([{ type: "string", value: "users" }]);
    const newPath = KeyCodec.encode([{ type: "string", value: "customers" }]);

    await repo.moveRecords("test-db", oldPath, newPath, false);

    // Verify 'users/alice' and 'users/bob' are moved (direct children)
    assertEquals((await testKv.get(["users", "alice"])).value, null);
    assertEquals((await testKv.get(["customers", "alice"])).value, "Alice");
    assertEquals((await testKv.get(["users", "bob"])).value, null);
    assertEquals((await testKv.get(["customers", "bob"])).value, "Bob");

    // Verify 'users/alice/settings' is NOT moved (grandchildren)
    assertEquals(
      (await testKv.get(["users", "alice", "settings"])).value,
      { theme: "dark" },
    );
  });

  await t.step(
    "Recursive Copy prefix 'users/alice' to 'backup/alice'",
    async () => {
      await setup();

      const oldPath = KeyCodec.encode([
        { type: "string", value: "users" },
        { type: "string", value: "alice" },
      ]);
      const newPath = KeyCodec.encode([
        { type: "string", value: "backup" },
        { type: "string", value: "alice" },
      ]);

      await repo.copyRecords("test-db", oldPath, newPath, true);

      // Verify old keys are STILL there
      assertEquals((await testKv.get(["users", "alice"])).value, "Alice");
      assertEquals(
        (await testKv.get(["users", "alice", "settings"])).value,
        { theme: "dark" },
      );

      // Verify new keys exist
      assertEquals((await testKv.get(["backup", "alice"])).value, "Alice");
      assertEquals(
        (await testKv.get(["backup", "alice", "settings"])).value,
        { theme: "dark" },
      );
    },
  );
});
