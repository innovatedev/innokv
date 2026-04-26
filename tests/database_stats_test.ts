import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
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

  // deno-lint-ignore no-explicit-any
  override async getDatabaseBySlugOrId(_id: string): Promise<any> {
    return await Promise.resolve({
      flat: () => ({ id: "test", type: "memory" as const, settings: {} }),
      id: "test",
      value: {
        id: "test",
        type: "memory" as const,
        settings: {},
        permissions: ["database:manage"],
      },
      // deno-lint-ignore no-explicit-any
    } as any);
  }
}

Deno.test("DatabaseRepository - Statistics Scan", async (t) => {
  const repo = new TestDatabaseRepository();

  // Helper to setup data
  async function setup() {
    // Clear all
    const iter = testKv.list({ prefix: [] });
    for await (const entry of iter) await testKv.delete(entry.key);

    // Create 10 records of different types
    await testKv.set(["user", 1], { name: "Alice" });
    await testKv.set(["user", 2], { name: "Bob" });
    await testKv.set(["config", "theme"], "dark");
    await testKv.set(["config", "lang"], "en");
    await testKv.set(["raw_data"], new Uint8Array([1, 2, 3]));
    await testKv.set(["count"], 42);
    await testKv.set(["is_active"], true);
    await testKv.set(["logs", 1], { msg: "start" });
    await testKv.set(["logs", 2], { msg: "stop" });
    await testKv.set(["empty"], null);
  }

  await t.step("Full Scan - Counts and Types", async () => {
    await setup();
    const stats = await repo.getDatabaseStats("test");

    assertEquals(stats.recordCount, 10, "Should count 10 records");
    assert(stats.sizeBytes > 0, "Should calculate a size > 0");
    assertEquals(
      stats.breakdown?.object,
      4,
      "Should find 4 objects (users, logs)",
    );
    assertEquals(stats.breakdown?.null, 1, "Should find 1 null");
    assertEquals(stats.breakdown?.string, 2, "Should find 2 strings (config)");
    assertEquals(stats.breakdown?.Uint8Array, 1, "Should find 1 Uint8Array");
    assertEquals(stats.isPartial, false, "Should be complete");
  });

  await t.step("Top Nodes Analysis", async () => {
    await setup();
    const stats = await repo.getDatabaseStats("test");

    assert(stats.topChildren && stats.topChildren.length > 0);

    // Top nodes should be "user", "config", "logs", etc.
    const userNode = stats.topChildren.find((c) => c.key.value === "user");
    assert(userNode, "Should identify 'user' as a top node");
    assertEquals(userNode.count, 2, "User node should have 2 records");

    const rawNode = stats.topChildren.find((c) => c.key.value === "raw_data");
    assert(rawNode, "Should identify 'raw_data' as a top node");
    assertEquals(rawNode.count, 1, "Raw data node should have 1 record");
  });

  await t.step("Partial Scan - Timeout", async () => {
    await setup();

    // Add 1000 more records to ensure it takes some time
    for (let i = 0; i < 1000; i++) {
      await testKv.set(["bulk", i], { i });
    }

    // Trigger a scan with an impossible timeout (0ms)
    const stats = await repo.getDatabaseStats("test", undefined, undefined, 0);

    assertEquals(stats.isPartial, true, "Should be marked as partial");
    assert(stats.recordCount < 1010, "Should not have finished all records");
  });

  await t.step("Concurrency Lock", async () => {
    await setup();

    // Start a long-running scan (simulated by not awaiting immediately)
    // Actually, getDatabaseStats is async, we can start it and then try another.

    const userId = "test-user-lock";

    // We'll use a promise that we don't await yet
    const scan1 = repo.getDatabaseStats("test", undefined, userId);

    // Immediate second scan for SAME user should fail
    await assertRejects(
      () => repo.getDatabaseStats("test", undefined, userId),
      Error,
      "A statistics scan is already in progress",
    );

    await scan1; // Cleanup
  });

  await t.step("Sub-path Scan", async () => {
    await setup();

    // Scan only the "user" prefix
    const stats = await repo.getDatabaseStats("test", "user");

    assertEquals(stats.recordCount, 2, "Should only count 2 users");
    const topNode = stats.topChildren?.[0];
    // Inside "user", children are [1] and [2]
    assert(topNode?.key.value === 1 || topNode?.key.value === 2);
  });
});
