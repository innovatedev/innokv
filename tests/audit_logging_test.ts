import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { db as kvdex } from "@/kv/db.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { ValueCodec } from "@/lib/ValueCodec.ts";

Deno.test({
  name: "Audit Logging - saveRecord creates an audit log",
  async fn() {
    const db = new DatabaseRepository(kvdex);
    const slug = `audit-test-${crypto.randomUUID()}`;
    const database = await kvdex.databases.add({
      name: "Audit Test DB",
      slug,
      path: ":memory:",
      type: "memory",
      mode: "rw",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!database.ok) throw new Error("Failed to create test database");

    const userId = "test-user-123";
    const key = ["audit", "test"];
    const value = { foo: "bar" };

    const result = await db.saveRecord(
      database.id,
      key,
      ValueCodec.encode(value),
      null,
      undefined,
      null,
      userId,
    );

    assertEquals(result.ok, true);

    // Wait a bit for async log write
    await new Promise((r) => setTimeout(r, 200));

    const { result: allLogs } = await kvdex.audit_logs.findBySecondaryIndex(
      "userId",
      userId,
    );

    const logs = allLogs.filter((l) => l.value.databaseId === database.id);

    assertExists(logs);
    assertEquals(logs.length, 1);
    assertEquals(logs[0].value.action, "set");
    assertEquals(logs[0].value.userId, userId);
    assertEquals(logs[0].value.databaseId, database.id);
    assertEquals(JSON.stringify(logs[0].value.key), JSON.stringify(key));
    // RichValue for object has nested RichValues in its value
    assertEquals(logs[0].value.newValue.value.foo.value, "bar");

    // Cleanup
    const kv = DatabaseRepository.memoryInstances.get(database.id);
    if (kv) {
      kv.close();
      DatabaseRepository.memoryInstances.delete(database.id);
    }
    await kvdex.databases.delete(database.id);
    await kvdex.audit_logs.delete(logs[0].id);
  },
});

Deno.test({
  name: "Audit Logging - deleteRecord creates an audit log",
  async fn() {
    const db = new DatabaseRepository(kvdex);
    const slug = `audit-delete-${crypto.randomUUID()}`;
    const database = await kvdex.databases.add({
      name: "Audit Delete Test",
      slug,
      path: ":memory:",
      type: "memory",
      mode: "rw",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!database.ok) throw new Error("Failed to create test database");

    const userId = "test-user-delete-unique";
    const key = ["audit", "delete"];
    const value = "delete-me";

    // First set a record
    await db.saveRecord(
      database.id,
      key,
      ValueCodec.encode(value),
      null,
      undefined,
      null,
      userId,
    );

    // Then delete it
    await db.deleteRecord(database.id, key, userId);

    await new Promise((r) => setTimeout(r, 200));

    const { result: logs } = await kvdex.audit_logs.findBySecondaryIndex(
      "userId",
      userId,
    );

    assertExists(logs);
    // Should have 2 logs: "set" and "delete"
    assertEquals(logs.length, 2);
    const deleteLog = logs.find((l) => l.value.action === "delete");
    assertExists(deleteLog);
    assertEquals(deleteLog.value.oldValue.value, value);

    // Cleanup
    const kv = DatabaseRepository.memoryInstances.get(database.id);
    if (kv) {
      kv.close();
      DatabaseRepository.memoryInstances.delete(database.id);
    }
    await kvdex.databases.delete(database.id);
    for (const log of logs) {
      await kvdex.audit_logs.delete(log.id);
    }
  },
});
