import { assertEquals } from "jsr:@std/assert@1";
import { handler } from "@/routes/(secure)/(database)/api/database/records.ts";
import { db as kvdex } from "@/kv/db.ts";
import { DatabaseRepository } from "@/lib/Database.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { Database } from "@/kv/models.ts";
import { ApiKvEntry } from "@/lib/types.ts";
import { RichValue } from "@/lib/ValueCodec.ts";

Deno.test("API - /api/database/records GET", async () => {
  // 1. Setup: Create a test database and record
  const repo = new DatabaseRepository(kvdex);
  const testDbSlug = "api-test-db-" + Date.now();
  const dbDoc = await repo.addDatabase({
    name: "API Test DB",
    slug: testDbSlug,
    type: "memory",
    path: ":memory:",
    mode: "rw",
  } as Database);

  const dbId = dbDoc.id;
  const kv = await repo.connectDatabase(dbDoc as Database);
  const now = new Date();
  await kv.atomic()
    .set(["test", "key"], { hello: "world" })
    .set(["test", "complex"], {
      big: 1234567890123456789n,
      date: now,
    })
    .commit();

  try {
    // 2. Mock Request and Context
    const url = new URL(
      `http://localhost/api/database/records?id=${dbId}&pathInfo=${
        KeyCodec.encode([])
      }`,
    );
    const req = new Request(url);

    const ctx = {
      req,
      url,
      state: {
        plugins: {
          permissions: {
            requires: () => {}, // Mock permissions check
          },
          kvAdmin: {
            databases: [dbDoc],
          },
        },
      },
    } as unknown as Parameters<typeof handler>[0];

    // 3. Call the handler
    const response = await handler(ctx);
    assertEquals(response.status, 200);

    const data = await response.json() as { records: ApiKvEntry<RichValue>[] };

    // 4. Assertions: Verify RichValue format
    const record = data.records.find((r: ApiKvEntry<RichValue>) =>
      r.key.length === 2 && r.key[1].value === "key"
    );

    const val = record?.value;
    if (!val) throw new Error("Record not found");
    assertEquals(val.type, "object");
    assertEquals(val.value.hello.type, "string");
    assertEquals(val.value.hello.value, "world");

    const complexRecord = data.records.find((r: ApiKvEntry<RichValue>) =>
      r.key.length === 2 && r.key[1].value === "complex"
    );
    const complexVal = complexRecord?.value;
    if (!complexVal) throw new Error("Complex record not found");

    assertEquals(complexVal.type, "object");
    assertEquals(complexVal.value.big.type, "bigint");
    assertEquals(complexVal.value.big.value, "1234567890123456789");
    assertEquals(complexVal.value.date.type, "date");
    assertEquals(complexVal.value.date.value, now.toISOString());
  } finally {
    // 5. Cleanup
    await repo.deleteDatabase(dbId);
    kv.close();
  }
});
