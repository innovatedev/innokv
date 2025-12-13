import { assert, assertEquals } from "jsr:@std/assert";
import { DatabaseRepository } from "../lib/Database.ts";
import { collection, kvdex, model } from "@olli/kvdex";
import { DatabaseModel } from "../lib/models.ts";
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
    super(mockDb as any);
  }

  // Override to return our testKv instead of opening new ones
  override async connectDatabase(_info: any) {
    return testKv;
  }

  // Helper to bypass database lookup
  override async getDatabase(_id: string) {
    return { value: { id: "test", type: "memory" } } as any;
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
    // pathInfo = "a" (encoded)
    // prefix = ["a"]
    // Should delete direct children of "a": ["a", "b"]
    // Should KEEP grandchildren: ["a", "b", "c"]
    // Should KEEP parent/sibling: ["a"], ["d"]
    // Wait, ["a"] represents the folder itself? No, ["a"] is a key.
    // If prefix is ["a"], ["a"] is NOT a child. It IS the prefix.
    // list({ prefix: ["a"] }) includes ["a", ...]

    // In DatabaseView, when we are IN folder "a", pathInfo is ["a"].
    // The list shows children: "b" (which is ["a", "b"]).
    // So if we select all, we want to delete ["a", "b"].
    // We do NOT want to delete ["a", "b", "c"].

    await repo.deleteRecords("test-db", {
      all: true,
      pathInfo: KeyCodec.encode([{ type: "string", value: "a" }]),
      recursive: false,
    });

    const resAB = await testKv.get(["a", "b"]);
    assertEquals(resAB.value, null, "Direct child 'a/b' should be deleted");

    const resABC = await testKv.get(["a", "b", "c"]);
    assert(resABC.value !== null, "Grandchild 'a/b/c' should REMAIN");

    const resA = await testKv.get(["a"]);
    // Prefix search includes the key itself?
    // Deno KV list({ prefix: ["a"] }) includes ["a"]?
    // Yes. But in DatabaseView logic:
    // If we are IN folder "a", we are usually seeing children.
    // DOES shallow delete delete the folder key itself?
    // keysToDelete.push(entry.key);
    // if recursive=false, it checks depth.
    // prefix length: 1.
    // key: ["a"] -> length 1.
    // key: ["a", "b"] -> length 2.
    // key: ["a", "b", "c"] -> length 3.
    // Check: `if (entry.key.length > prefix.length + 1) continue;`
    // ["a"]: 1 <= 1+1 (True). So ["a"] would be deleted?
    // User intent: "select matching" in list view.
    // List view of "a" shows "b".
    // It does NOT show "a" (current folder).
    // EXCEPT if "a" has a value.
    // But usually we filter out the exact prefix key in the UI?
    // Or maybe we don't.
    // If we use `kv.list({ prefix })`, it includes the prefix.
    // If I delete "a" (the folder metadata?), that seems fine if I selected "All".
    // But usually "Select All" means "Select All Visible Items".
    // If "a" is not visible, it shouldn't be deleted.
    // However, for SAFETY, deleting ["a"] is fine (it's just a value).
    // The critical thing is NOT deleting ["a", "b", "c"].
    // ["a", "b"] is length 2. 2 <= 2. OK.
    // ["a", "b", "c"] is length 3. 3 > 2. SKIP. Correct.

    // So verification:
    // ["a", "b"] deleted.
    // ["a", "b", "c"] KEPT.
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
