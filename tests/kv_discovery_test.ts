import { assertEquals } from "https://deno.land/std@0.184.0/testing/asserts.ts";

Deno.test("KV Key Discovery Bug Reproduction", async (t) => {
  const kv = await Deno.openKv(":memory:");

  // Helper to add data
  async function add(key: Deno.KvKey) {
    await kv.set(key, "val");
  }

  // Populate with a structure that mimics the user's data
  // "sessions" (many items), "urls", "users".
  for (let i = 0; i < 50; i++) {
    await add(["sessions", `session-${i}`]);
  }
  await add(["urls", "url-1"]);
  await add(["users", "user-1"]);
  await add(["actions", "action-1"]); // Should appear before sessions/urls/users

  // Mock getRecords logic
  async function _getRecords(prefix: Deno.KvKey, limit = 10) {
    const records: Deno.KvKey[] = [];
    let currentStart: Deno.KvKey = [...prefix];
    const depth = prefix.length;

    // START TEST LOGIC: (Copied from Database.ts logic)
    // Simplified for verification of logic flow

    let useStart = false; // Initial fetch uses default unless cursor is present

    while (records.length < limit) {
      // deno-lint-ignore no-explicit-any
      const selector: any = { prefix };
      if (useStart) {
        selector.start = currentStart;
      }

      const iter = kv.list(selector, { limit: 1 });
      const entry = await iter.next();

      if (entry.done) break;

      const { key } = entry.value;

      // Handle Exact Match (Root Value)
      if (key.length === depth) {
        currentStart = [...prefix, "\x00"];
        useStart = true;
        continue;
      }

      const partVal = key[depth];

      if (key.length === depth + 1) {
        // Direct child
        records.push(key);
      }

      // SKIP DESCENDANTS LOGIC
      const nextStart: Deno.KvKey = [...prefix, partVal, true];

      currentStart = nextStart;
      useStart = true;
    }

    return records;
  }

  await t.step("Find all top level keys with Small Limit", async () => {
    // getRecords returns RECORDS (leaves/nodes at this level).
  });

  async function getNodes(prefix: Deno.KvKey) {
    const nodes: Deno.KvKeyPart[] = [];
    const depth = prefix.length;
    let currentStart: Deno.KvKey = [...prefix];

    let useStart = false; // Initial fetch uses default unless verified

    while (true) {
      // deno-lint-ignore no-explicit-any
      const selector: any = { prefix };
      if (useStart) selector.start = currentStart;

      const iter = kv.list(selector, { limit: 1 });
      const entry = await iter.next();
      if (entry.done) break;

      const { key } = entry.value;

      if (key.length <= depth) {
        currentStart = [...prefix, "\x00"];
        useStart = true;
        continue;
      }

      const partVal = key[depth];

      nodes.push(partVal);

      // Next start
      const nextStart: Deno.KvKey = [...prefix, partVal, true];

      currentStart = nextStart;
      useStart = true;
    }
    return nodes;
  }

  await t.step("getNodes execution", async () => {
    const nodes = await getNodes([]);
    // specific order check
    // actions, sessions, urls, users
    assertEquals(nodes.includes("actions"), true, "actions found");
    assertEquals(nodes.includes("sessions"), true, "sessions found");
    assertEquals(nodes.includes("urls"), true, "urls found");
    assertEquals(nodes.includes("users"), true, "users found");
  });

  // Clean up
  kv.close();
});
