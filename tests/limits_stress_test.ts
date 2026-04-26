import { assert, assertEquals } from "jsr:@std/assert@1";
import { KvExplorer } from "../lib/KvExplorer.ts";

Deno.test("Deno KV Limits - Stress Test", async (t) => {
  const db = await Deno.openKv(":memory:");
  const explorer = new KvExplorer(db);

  await t.step("Large record (near 64KB limit)", async () => {
    const largeData = "x".repeat(64 * 1024 - 100); // ~63.9 KB
    const key = ["stress", "large"];

    await db.set(key, largeData);

    const { records } = await explorer.getRecords(["stress"], {
      recursive: true,
    });
    assert(records.length > 0);
    assert(records[0].size !== undefined);
    assert(records[0].size > 60 * 1024);
  });

  await t.step("Massive number of records (beyond 1000 limit)", async () => {
    // Insert 1500 records
    const BATCH = 100;
    for (let i = 0; i < 1500; i += BATCH) {
      const atomic = db.atomic();
      for (let j = 0; j < BATCH && (i + j) < 1500; j++) {
        atomic.set(["massive", i + j], "val");
      }
      await atomic.commit();
    }

    // Now test moveRecords which uses atomics with batching
    const result = await explorer.moveRecords(["massive"], ["massive_moved"]);
    assert(result.ok);
    assertEquals(result.movedCount, 1500);
  });

  db.close();
});
