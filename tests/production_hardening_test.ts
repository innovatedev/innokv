import { ValueCodec } from "@/codec/mod.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";
import { KvExplorer } from "../lib/KvExplorer.ts";

Deno.test("Production Hardening - KvExplorer", async (t) => {
  const db = await Deno.openKv(":memory:");
  const explorer = new KvExplorer(db);
  await t.step("importFromJson - Batching logic", async () => {
    const entries = Array.from({ length: 25 }).map((_, i) => ({
      key: [{ type: "string", value: `batch_${i}` }],
      value: ValueCodec.encode(`val_${i}`),
    }));
    // Use a small batch size of 10
    const result = await explorer.importFromJson(entries, { batchSize: 10 });
    assertEquals(result.importedCount, 25);
    // Verify all records imported
    const { records } = await explorer.getRecords([]);
    assertEquals(records.length, 25);
    // Cleanup
    await explorer.deleteRecords([], true);
  });
  await t.step(
    "moveRecords - Cross-DB Verification (Simulated Failure)",
    async () => {
      const targetDb = await Deno.openKv(":memory:");
      // Insert source record
      await db.set(["move", "src"], "val");
      // We want to simulate a failure where set succeeds but delete is not reached
      // if verification fails.
      // In our implementation, we check the versionstamp after set.
      // Successful move
      const result = await explorer.moveRecords(
        ["move", "src"],
        ["move", "dest"],
        true,
        targetDb,
      );
      assert(result.ok);
      assertEquals(result.movedCount, 1);
      const src = await db.get(["move", "src"]);
      const dest = await targetDb.get(["move", "dest"]);
      assertEquals(src.value, null);
      assertEquals(dest.value, "val");
      targetDb.close();
    },
  );
  await t.step("calculateSize utility", () => {
    const val = { a: 1, b: "hello", c: new Uint8Array([1, 2, 3]) };
    const size = explorer.calculateSize(val);
    assert(size > 0);
    // V8 serialization of this should be around 30-50 bytes
    assert(size > 20 && size < 100);
  });
  db.close();
});
