import { KeySerialization, ValueCodec } from "@/codec/mod.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";
import { KvExplorer } from "../lib/KvExplorer.ts";

Deno.test("Integration Fidelity - Full Type Support in Keys and Values", async (t) => {
  const db = await Deno.openKv(":memory:");
  const explorer = new KvExplorer(db);
  const complexTypes = [
    { name: "string", key: ["type", "string"], value: "hello" },
    { name: "number", key: ["type", 123], value: 456 },
    { name: "bigint", key: ["type", 100n], value: 200n },
    { name: "boolean", key: ["type", true], value: false },
    {
      name: "Uint8Array",
      key: ["type", new Uint8Array([1, 2, 3])],
      value: new Uint8Array([4, 5, 6]),
    },
    {
      name: "Date",
      key: ["type", "date"],
      value: new Date("2024-01-01T00:00:00Z"),
    },
    {
      name: "Map",
      key: ["type", "map"],
      value: new Map<unknown, unknown>([["k", "v"], [1, 2]]),
    },
    { name: "Set", key: ["type", "set"], value: new Set<unknown>([1, 2, 3]) },
    { name: "RegExp", key: ["type", "regexp"], value: /foo/gi },
    { name: "Error", key: ["type", "error"], value: new Error("fail") },
    { name: "NaN", key: ["type", NaN], value: NaN },
    { name: "Infinity", key: ["type", Infinity], value: Infinity },
  ];
  for (const item of complexTypes) {
    await db.set(item.key as Deno.KvKey, item.value);
  }
  await t.step("getRecords preserves types bit-for-bit", async () => {
    const { records } = await explorer.getRecords(["type"]);
    assertEquals(records.length, complexTypes.length);
    for (const item of complexTypes) {
      const record = records.find((r) => {
        // Compare keys (decoded)
        const decodedKey = r.key.map((k) =>
          KeySerialization.parse(k)
        ) as Deno.KvKey;
        if (decodedKey.length !== item.key.length) return false;
        return decodedKey.every((p, i) => {
          if (p instanceof Uint8Array && item.key[i] instanceof Uint8Array) {
            return p.every((v, j) => v === (item.key[i] as Uint8Array)[j]);
          }
          if (typeof p === "number" && isNaN(p)) {
            return isNaN(item.key[i] as number);
          }
          return p === item.key[i];
        });
      });
      assert(record, `Should find record for ${item.name}`);
      const decodedValue = ValueCodec.decode(record.value);
      if (item.value instanceof Date) {
        assertEquals((decodedValue as Date).getTime(), item.value.getTime());
      } else if (item.value instanceof Uint8Array) {
        assertEquals(
          Array.from(decodedValue as Uint8Array),
          Array.from(item.value),
        );
      } else if (item.value instanceof Map) {
        assertEquals(
          Array.from((decodedValue as Map<unknown, unknown>).entries()),
          Array.from(item.value.entries()),
        );
      } else if (item.value instanceof Set) {
        assertEquals(
          Array.from(decodedValue as Set<unknown>),
          Array.from(item.value),
        );
      } else if (item.value instanceof RegExp) {
        assertEquals((decodedValue as RegExp).source, item.value.source);
        assertEquals((decodedValue as RegExp).flags, item.value.flags);
      } else if (item.value instanceof Error) {
        assertEquals((decodedValue as Error).message, item.value.message);
      } else if (typeof item.value === "number" && isNaN(item.value)) {
        assert(typeof decodedValue === "number" && isNaN(decodedValue));
      } else {
        assertEquals(decodedValue, item.value);
      }
    }
  });
  await t.step("moveRecords preserves types", async () => {
    await explorer.moveRecords(["type"], ["moved"]);
    const { records } = await explorer.getRecords(["moved"]);
    assertEquals(records.length, complexTypes.length);
    // Check one specific complex item: bigint
    const bigintRecord = records.find((r) =>
      r.key.some((p) => p.type === "bigint" && p.value === "100")
    );
    assert(bigintRecord, "Should find moved bigint record");
    assertEquals(ValueCodec.decode(bigintRecord.value), 200n);
  });
  await t.step("export/import preserves types", async () => {
    const exported = await explorer.exportToJson(["moved"]);
    // Clear moved
    const iter = db.list({ prefix: ["moved"] });
    for await (const entry of iter) await db.delete(entry.key);
    // Import to "imported"
    const importedData = exported.map((e) => {
      const newKey = [...e.key];
      newKey[0] = { type: "string", value: "imported" };
      return { ...e, key: newKey };
    });
    await explorer.importFromJson(importedData);
    const { records } = await explorer.getRecords(["imported"]);
    assertEquals(records.length, complexTypes.length);
    // Check one specific complex item: Uint8Array
    const u8Record = records.find((r) =>
      r.key.some((p) =>
        p.type === "Uint8Array" && Array.isArray(p.value) && p.value[0] === 1
      )
    );
    assert(u8Record, "Should find imported u8 record");
    const val = ValueCodec.decode(u8Record.value) as Uint8Array;
    assert(val instanceof Uint8Array);
    assertEquals(val[0], 4);
    assertEquals(val[1], 5);
  });
  db.close();
});
