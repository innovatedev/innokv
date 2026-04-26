import { KvExplorer } from "@/lib/KvExplorer.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.test("Recursive Operations - Export/Import", async (t) => {
  const kv = await Deno.openKv(":memory:");
  const explorer = new KvExplorer(kv);

  // Setup data
  await kv.set(["data", "a"], "val_a");
  await kv.set(["data", "b", "c"], {
    date: new Date("2024-01-01T00:00:00Z"),
    big: 123n,
    u8: new Uint8Array([1, 2, 3]),
  });
  await kv.set(["data", 123n], "bigint-key");
  await kv.set(["other"], "ignore");

  await t.step("Export data under 'data'", async () => {
    const exported = await explorer.exportToJson(["data"]);
    assertEquals(exported.length, 3);
    assert(
      exported.some((e) =>
        e.key.some((p) => p.type === "bigint" && p.value === "123")
      ),
    );
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
    assertEquals(result.importedCount, 3);

    const valA = await kv.get(["restored", "a"]);
    assertEquals(valA.value, "val_a");

    const valC = await kv.get(["restored", "b", "c"]);
    const val = valC.value as { date: Date; big: bigint; u8: Uint8Array };
    assertEquals(
      val.date.getTime(),
      new Date("2024-01-01T00:00:00Z").getTime(),
    );
    assertEquals(val.big, 123n);
    assertEquals(Array.from(val.u8), [1, 2, 3]);

    const valBigKey = await kv.get(["restored", 123n]);
    assertEquals(valBigKey.value, "bigint-key");
  });

  kv.close();
});
