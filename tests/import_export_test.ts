import { KvExplorer } from "@/lib/KvExplorer.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.test("Recursive Operations - Export/Import", async (t) => {
  const kv = await Deno.openKv(":memory:");
  const explorer = new KvExplorer(kv);

  // Setup data
  await kv.set(["data", "a"], "val_a");
  await kv.set(["data", "b", "c"], "val_c");
  await kv.set(["other"], "ignore");

  await t.step("Export data under 'data'", async () => {
    const exported = await explorer.exportToJson(["data"]);
    assertEquals(exported.length, 2);
    // Check that one has key part "a"
    assert(exported.some((e) => e.key.some((p) => p.value === "a")));
  });

  await t.step("Import data to 'restored'", async () => {
    const exported = await explorer.exportToJson(["data"]);
    // Modify keys to point to 'restored'
    const importedData = exported.map((e) => {
      const newKey = [...e.key];
      newKey[0] = { type: "string", value: "restored" };
      return { ...e, key: newKey };
    });

    const result = await explorer.importFromJson(importedData);
    assertEquals(result.importedCount, 2);

    const valA = await kv.get(["restored", "a"]);
    assertEquals(valA.value, "val_a");

    const valC = await kv.get(["restored", "b", "c"]);
    assertEquals(valC.value, "val_c");
  });

  kv.close();
});
