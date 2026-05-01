import { KeyCodec } from "@/codec/mod.ts";
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { DatabaseRepository } from "../lib/Database.ts";
import { collection, kvdex } from "@olli/kvdex";
import { AuditLogModel, DatabaseModel } from "@/kv/models.ts";

// Mock KVs for testing
const sourceKv = await Deno.openKv(":memory:");
const targetKv = await Deno.openKv(":memory:");
// Mock DB schema
const mockDb = kvdex({
  kv: await Deno.openKv(":memory:"),
  schema: {
    databases: collection(DatabaseModel),
    audit_logs: collection(AuditLogModel),
  },
});
class TestDatabaseRepository extends DatabaseRepository {
  constructor() {
    // deno-lint-ignore no-explicit-any
    super(mockDb as any);
  }
  // deno-lint-ignore no-explicit-any
  override async connectDatabase(info: any) {
    if (info.id === "source") return await Promise.resolve(sourceKv);
    if (info.id === "target") return await Promise.resolve(targetKv);
    if (info.id === "readonly") return await Promise.resolve(sourceKv);
    return await Promise.resolve(sourceKv);
  }
  override async getDatabaseBySlugOrId(id: string) {
    const mode = id === "readonly" ? "r" : "rw";
    return await Promise.resolve({
      flat: () => ({ id, name: id, type: "memory", mode }),
      id,
      value: { id, name: id, type: "memory", mode },
      // deno-lint-ignore no-explicit-any
    } as any);
  }
}
Deno.test("Portability - Cross-Database Move", async (t) => {
  const repo = new TestDatabaseRepository();
  async function setup() {
    // Clear KVs
    for await (const entry of sourceKv.list({ prefix: [] })) {
      await sourceKv.delete(entry.key);
    }
    for await (const entry of targetKv.list({ prefix: [] })) {
      await targetKv.delete(entry.key);
    }
    // Setup source:
    // data/item1 -> "Value 1"
    await sourceKv.set(["data", "item1"], "Value 1");
  }
  await t.step("Move 'data' from source to target", async () => {
    await setup();
    const oldPath = KeyCodec.encode([{ type: "string", value: "data" }]);
    const newPath = "migrated"; // String path to be parsed by KvExplorer
    await repo.moveRecords("source", {
      oldPath,
      newPath,
      recursive: true,
      targetId: "target",
    });
    // Verify source is empty
    assertEquals((await sourceKv.get(["data", "item1"])).value, null);
    // Verify target has data
    assertEquals((await targetKv.get(["migrated", "item1"])).value, "Value 1");
  });
  await t.step(
    "Move 'data' from source to readonly target (should fail)",
    async () => {
      await setup();
      const oldPath = KeyCodec.encode([{ type: "string", value: "data" }]);
      await assertRejects(
        () =>
          repo.moveRecords("source", {
            oldPath,
            newPath: "fail",
            recursive: true,
            targetId: "readonly",
          }),
        Error,
        "is read-only",
      );
    },
  );
  await t.step("Move from readonly source (should fail)", async () => {
    await setup();
    const oldPath = KeyCodec.encode([{ type: "string", value: "data" }]);
    await assertRejects(
      () =>
        repo.moveRecords("readonly", {
          oldPath,
          newPath: "fail",
          recursive: true,
          targetId: "target",
        }),
      Error,
      "is read-only",
    );
  });
});
Deno.test("Portability - Cross-Database Copy", async (t) => {
  const repo = new TestDatabaseRepository();
  async function setup() {
    // Clear KVs
    for await (const entry of sourceKv.list({ prefix: [] })) {
      await sourceKv.delete(entry.key);
    }
    for await (const entry of targetKv.list({ prefix: [] })) {
      await targetKv.delete(entry.key);
    }
    await sourceKv.set(["data", "item1"], "Value 1");
  }
  await t.step("Copy 'data' from readonly source to target", async () => {
    await setup();
    const oldPath = KeyCodec.encode([{ type: "string", value: "data" }]);
    const newPath = "backup";
    // Duplication from readonly source should work!
    await repo.copyRecords("readonly", {
      oldPath,
      newPath,
      recursive: true,
      targetId: "target",
    });
    // Verify source still has data
    assertEquals((await sourceKv.get(["data", "item1"])).value, "Value 1");
    // Verify target has data
    assertEquals((await targetKv.get(["backup", "item1"])).value, "Value 1");
  });
});
