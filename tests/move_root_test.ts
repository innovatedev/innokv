import { KeyCodec } from "@/codec/mod.ts";
import { assertEquals } from "jsr:@std/assert@1";
import { DatabaseRepository } from "../lib/Database.ts";
import { collection, kvdex } from "@olli/kvdex";
import { AuditLogModel, DatabaseModel } from "@/kv/models.ts";

// Mock KV for testing
const testKv = await Deno.openKv(":memory:");
// Mock DB schema
const mockDb = kvdex({
  kv: testKv,
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
  override async connectDatabase(_info: any) {
    return await Promise.resolve(testKv);
  }
  override async getDatabaseBySlugOrId(id: string) {
    return await Promise.resolve({
      flat: () => ({ id, type: "memory", mode: "rw" }),
      id,
      value: { id, type: "memory", mode: "rw" },
      // deno-lint-ignore no-explicit-any
    } as any);
  }
}
Deno.test("Recursive Operations - Move to Root", async (t) => {
  const repo = new TestDatabaseRepository();
  async function setup() {
    // Clear KV
    for await (const entry of testKv.list({ prefix: [] })) {
      await testKv.delete(entry.key);
    }
    await testKv.set(["folder", "key1"], "Value 1");
    await testKv.set(["folder", "sub", "key2"], "Value 2");
  }
  await t.step("Move folder to root", async () => {
    await setup();
    const oldPath = KeyCodec.encode([{ type: "string", value: "folder" }]);
    const newPath = ""; // Root
    await repo.moveRecords("test", {
      oldPath,
      newPath,
      recursive: true,
    });
    // folder/key1 -> key1
    assertEquals((await testKv.get(["key1"])).value, "Value 1");
    // folder/sub/key2 -> sub/key2
    assertEquals((await testKv.get(["sub", "key2"])).value, "Value 2");
    // Verify old path is gone
    assertEquals((await testKv.get(["folder", "key1"])).value, null);
  });
  await t.step("Move selected keys to root", async () => {
    await setup();
    const newPath = ""; // Root
    const keys = [
      [{ type: "string", value: "folder" }, { type: "string", value: "key1" }],
    ];
    await repo.moveRecords("test", {
      keys: keys.map((k) => k.map((p) => repo.parseKeyPart(p))),
      newPath,
      recursive: true,
      sourcePath: KeyCodec.encode([{ type: "string", value: "folder" }]),
    });
    // key1 should be at root now
    assertEquals((await testKv.get(["key1"])).value, "Value 1");
    // folder/sub/key2 should still be there
    assertEquals(
      (await testKv.get(["folder", "sub", "key2"])).value,
      "Value 2",
    );
    // folder/key1 should be gone
    assertEquals((await testKv.get(["folder", "key1"])).value, null);
  });
});
