import { assert, assertEquals } from "jsr:@std/assert@1";
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

// Mock Repository that uses the SAME KV instance for "connected" databases
class TestDatabaseRepository extends DatabaseRepository {
  constructor() {
    // deno-lint-ignore no-explicit-any
    super(mockDb as any);
  }

  // Override to return our testKv instead of opening new ones
  // deno-lint-ignore no-explicit-any
  override async connectDatabase(_info: any) {
    return await Promise.resolve(testKv);
  }

  // Helper to bypass database lookup
  override async getDatabase(_id: string) {
    return await Promise.resolve(
      // deno-lint-ignore no-explicit-any
      { value: { id: "test", type: "memory" } } as any,
    );
  }
}

Deno.test("DatabaseRepository - Shallow Delete vs Recursive Delete", async (t) => {
  const repo = new TestDatabaseRepository();

  // Helper to setup data
  async function setup() {
    // Clear all
    const iter = testKv.list({ prefix: [] });
    for await (const entry of iter) await testKv.delete(entry.key);

    // Create structure:
    // root (depth 0 effectively) -> but keys are depth 1
    // a
    // a/b
    // a/b/c
    // d

    // In KV terms:
    // ["a"]
    // ["a", "b"]
    // ["a", "b", "c"]
    // ["d"]

    await testKv.set(["a"], "val_a");
    await testKv.set(["a", "b"], "val_a_b");
    await testKv.set(["a", "b", "c"], "val_a_b_c");
    await testKv.set(["d"], "val_d");
  }

  await t.step("Shallow Delete Root (pathInfo='')", async () => {
    await setup();

    // Action: Delete all matching at root, recursive=false
    await repo.deleteRecords("test-db", {
      all: true,
      pathInfo: KeyCodec.encode([]), // ""
      recursive: false,
    });

    // Expectation:
    // ["a"] -> Deleted (depth 1)
    // ["d"] -> Deleted (depth 1)
    // ["a", "b"] -> Kept (depth 2)
    // ["a", "b", "c"] -> Kept (depth 3)

    const resA = await testKv.get(["a"]);
    assertEquals(resA.value, null, "Root key 'a' should be deleted");

    const resD = await testKv.get(["d"]);
    assertEquals(resD.value, null, "Root key 'd' should be deleted");

    const resAB = await testKv.get(["a", "b"]);
    assert(resAB.value !== null, "Nested key 'a/b' should REMAIN");

    const resABC = await testKv.get(["a", "b", "c"]);
    assert(resABC.value !== null, "Nested key 'a/b/c' should REMAIN");
  });

  await t.step("Shallow Delete Folder (pathInfo='a')", async () => {
    await setup();

    // Action: Delete all matching under "a", recursive=false
    await repo.deleteRecords("test-db", {
      all: true,
      pathInfo: KeyCodec.encode([{ type: "string", value: "a" }]),
      recursive: false,
    });

    const resAB = await testKv.get(["a", "b"]);
    assertEquals(resAB.value, null, "Direct child 'a/b' should be deleted");

    const resABC = await testKv.get(["a", "b", "c"]);
    assert(resABC.value !== null, "Grandchild 'a/b/c' should REMAIN");

    const _resA = await testKv.get(["a"]);
  });

  await t.step("Deep Delete Root (recursive implicit)", async () => {
    await setup();

    // Action: recursive=undefined (default true)
    await repo.deleteRecords("test-db", {
      all: true,
      pathInfo: KeyCodec.encode([]),
      // recursive: true // default
    });

    const resA = await testKv.get(["a"]);
    assertEquals(resA.value, null);
    const resAB = await testKv.get(["a", "b"]);
    assertEquals(resAB.value, null);
    const resABC = await testKv.get(["a", "b", "c"]);
    assertEquals(resABC.value, null);
    const resD = await testKv.get(["d"]);
    assertEquals(resD.value, null);
  });
});
