import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { KvExplorer } from "../lib/KvExplorer.ts";

const db = await Deno.openKv(":memory:");

Deno.test("KvExplorer - Key Sorting", async () => {
  // Verify assumptions: Uint8Array < string < number < bigint < true
  await db.atomic()
    .set(["sort", new Uint8Array([1])], 1)
    .set(["sort", "a"], 2)
    .set(["sort", 10], 3)
    .set(["sort", 100n], 4)
    .set(["sort", true], 5)
    .commit();

  const explorer = new KvExplorer(db);
  const { keys } = await explorer.getTopLevelKeys(["sort"]);

  assertEquals(keys.length, 5);
  assertEquals(keys[0].type, "Uint8Array");
  assertEquals(keys[1].value, "a");
  assertEquals(keys[2].type, "bigint");
  assertEquals(keys[3].value, "10");
  assertEquals(keys[4].value, "true");
});

Deno.test("KvExplorer - Skip Scan (Large Dataset)", async () => {
  // Insert 1000 records under ["large", "a", i]
  // Insert 1 record under ["large", "b"]
  // Insert 1 record under ["large", "c"]

  // Batch writes to avoid atomic limit
  const BATCH = 50;
  for (let i = 0; i < 1000; i += BATCH) {
    const atomic = db.atomic();
    for (let j = 0; j < BATCH && i + j < 1000; j++) {
      atomic.set(["large", "a", i + j], "val");
    }
    await atomic.commit();
  }

  const atomic = db.atomic();
  atomic.set(["large", "b"], "val");
  atomic.set(["large", "c"], "val");
  await atomic.commit();

  const explorer = new KvExplorer(db);

  // Should find 'a', 'b', 'c' quickly without iterating 1000 'a's
  const start = performance.now();
  const { keys } = await explorer.getTopLevelKeys(["large"]);
  const duration = performance.now() - start;

  console.log(`Skip scan took ${duration}ms`);

  assertEquals(keys.length, 3);
  assertEquals(keys[0].value, "a");
  assertEquals(keys[1].value, "b");
  assertEquals(keys[2].value, "c");
});

Deno.test("KvExplorer - Nested Records (Recursive vs Flat)", async () => {
  await db.atomic()
    .set(["nest", "parent"], "p")
    .set(["nest", "parent", "child"], "c")
    .set(["nest", "parent", "child", "grandchild"], "gc")
    .commit();

  const explorer = new KvExplorer(db);

  // Recursive
  const rec = await explorer.getRecords(["nest"], { recursive: true });
  assertEquals(rec.records.length, 3);

  // Flat (recursive: false) -> Should only see "parent", but NOT "child" or "grandchild"
  // Wait, ["nest", "parent"] is depth 2 (prefix=1 + 1).
  // ["nest", "parent", "child"] is depth 3.
  // So flat should return ["nest", "parent"].
  const flat = await explorer.getRecords(["nest"], { recursive: false });
  assertEquals(flat.records.length, 1);
  assertEquals(flat.records[0].key, ["nest", "parent"]);
});

Deno.test("KvExplorer - Mixed Record and Folder", async () => {
  // Setup:
  // ["users", "charlie"] -> value (Record)
  // ["users", "charlie", "deep"] -> value (Child)
  await db.atomic()
    .set(["mixed", "charlie"], "charlie_data")
    .set(["mixed", "charlie", "deep"], "charlie_deep")
    .set(["mixed", "a"], "a_data") // Add for new assertions
    .set(["mixed", "a", "b"], "b_data") // Add for new assertions
    .set(["mixed", "d"], "d_data") // Add for new assertions
    .commit();

  const explorer = new KvExplorer(db);
  const { keys } = await explorer.getTopLevelKeys(["mixed"]);

  assertEquals(keys.length, 3, "Should have 3 keys: a, charlie, d");

  const charlie = keys.find((k) => k.value === "charlie");
  assert(charlie, "Key 'charlie' should exist");
  assertEquals(charlie.value, "charlie");
  // Crucial check: must be true because it has child "deep"
  assertEquals(charlie.hasChildren, true, "charlie should have children");

  // Verify structure
  const keyA = keys.find((k) => k.value === "a");
  const keyD = keys.find((k) => k.value === "d");

  assert(keyA, "Key 'a' should exist");
  assertEquals(keyA?.hasChildren, true, "Key 'a' should have children");

  assert(keyD, "Key 'd' should exist");
  assertEquals(keyD?.hasChildren, false, "Key 'd' should NOT have children");

  // Verify child
  const children = await explorer.getTopLevelKeys(["mixed", "charlie"]);
  assertEquals(children.keys.length, 1);
  assertEquals(children.keys[0].value, "deep");
});

// Cleanup
Deno.test({
  name: "Close DB",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    db.close();
  },
});
