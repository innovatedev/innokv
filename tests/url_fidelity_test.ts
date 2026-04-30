import {
  assertEquals,
  assertInstanceOf,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ValueCodec } from "@/codec/mod.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { db as kvdex } from "@/kv/db.ts";
import type { Database } from "@/kv/models.ts";

Deno.test("ValueCodec - URL Fidelity", () => {
  const url = new URL("https://example.com/path?query=1");
  const encoded = ValueCodec.encode(url);

  assertEquals(encoded.type, "URL");
  assertEquals(encoded.value, "https://example.com/path?query=1");

  const decoded = ValueCodec.decode(encoded);
  assertInstanceOf(decoded, URL);
  assertEquals((decoded as URL).href, "https://example.com/path?query=1");
});

Deno.test("Database.saveRecord - URL Fidelity", async () => {
  const repo = new DatabaseRepository(kvdex);

  // Create a temporary database
  const dbRes = await kvdex.databases.add({
    name: "URL Test DB",
    slug: "url-test-" + Date.now(),
    type: "memory",
    path: ":memory:",
    settings: {
      batchSize: 100,
      scanTimeout: 30000,
    },
    mode: "rw",
    createdAt: new Date(),
  });

  if (!dbRes.ok) throw new Error("Failed to create test database");
  const dbDoc = await kvdex.databases.find(dbRes.id);
  if (!dbDoc) throw new Error("Failed to fetch created database");
  const db = dbDoc.flat();

  try {
    const key: Deno.KvKey = ["test", "url"];
    const url = new URL("https://innokv.dev");
    const richValue = ValueCodec.encode(url);

    // 1. Save as RichValue (simulating Web UI)
    await repo.saveRecord(db.id, key, richValue);

    // 2. Verify it is stored as a RichValue URL in Deno KV (since native URL is not supported)
    const kv = await repo.connectDatabase(db as unknown as Database);
    const entry = await kv.get(key);

    assertEquals(
      ValueCodec.isRichValue(entry.value),
      true,
      "Value in KV should be a RichValue object",
    );
    assertEquals((entry.value as Record<string, unknown>).type, "URL");

    // 3. Verify it is read back correctly by getRecords
    const res = await repo.getRecords(db.id, "test");
    const record = res.records[0];

    assertEquals(record.value.type, "URL", "Should be read back as URL type");
    assertEquals(record.value.value, "https://innokv.dev/");

    kv.close();
  } finally {
    // Cleanup
    await kvdex.databases.delete(db.id);
  }
});
