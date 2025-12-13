import { assertEquals } from "https://deno.land/std@0.184.0/testing/asserts.ts";
import { KeyCodec } from "../lib/KeyCodec.ts";

Deno.test("KV Key Discovery Bug Reproduction", async (t) => {
  const kv = await Deno.openKv(":memory:");

  // Helper to add data
  async function add(key: any[]) {
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
  async function getRecords(prefix: any[], limit = 10) {
    const records: any[] = [];
    let currentStart = [...prefix];
    const depth = prefix.length;
    let nextCursor = "";

    // START TEST LOGIC: (Copied from Database.ts logic)
    // Simplified for verification of logic flow

    // We assume getRecords already fixed:
    // ...
    let useStart = false; // Initial fetch uses default unless cursor is present (not testing cursor for now)

    while (records.length < limit) {
      const selector: any = { prefix };
      if (useStart) {
        selector.start = currentStart;
      }

      // console.log("List with start:", useStart ? currentStart : "DEFAULT");

      const iter = kv.list(selector, { limit: 1 });
      const entry = await iter.next();

      if (entry.done) break;

      const { key } = entry.value;

      // Handle Exact Match (Root Value)
      if (key.length === depth) {
        currentStart = [...prefix, "\x00"];
        useStart = true;
        // Note: we don't push root value in this simplified test unless needed
        continue;
      }

      const partVal = key[depth];
      // console.log(`Found part: ${partVal}`);

      if (key.length === depth + 1) {
        // Direct child
        records.push(key);
      }

      // SKIP DESCENDANTS LOGIC
      // const nextStart: any = [...prefix, partVal, "\uFFFF\uFFFF"]; // OLD BAD LOGIC
      const nextStart: any = [...prefix, partVal, true]; // NEW FIXED LOGIC

      currentStart = nextStart;
      useStart = true;
    }

    return records;
  }

  await t.step("Find all top level keys with Small Limit", async () => {
    // If limit is small (e.g. 5), can we find 'actions', 'sessions', 'urls', 'users'?
    // Wait, 'sessions' is one KEY.
    // If strict layer iteration works, we should find ["actions", ...], ["sessions", ...], ["urls", ...], ["users", ...]
    // BUT since we are at root, we only see the first level parts.
    // getRecords returns RECORDS (leaves/nodes at this level).
    // Actually, getRecords as implemented currently returns DIRECT CHILDREN only?
    // And SKIPS descendants.
    // So for ["sessions", "id1"], it sees "sessions".
    // Is "sessions" a record? Or a folder?
    // In strict KV, ["sessions"] might not exist as a key. Only ["sessions", "id1"].
    // If ["sessions"] does not exist, then `key.length === depth + 1` is FALSE for `["sessions", "id1"]`.
    // It is `depth + 2`.
    // So getRecords SKIPS it.

    // Wait. `getRecords` logic:
    // if (key.length === depth + 1) -> records.push.
    // else -> SKIP.

    // So `getRecords` ONLY returns direct children (files in current folder).
    // It does NOT return folders. `getNodes` returns folders.

    // The user's complaint: "Not all top-level keys are being retrieved".
    // If they are looking at `getNodes` (Folders), then we need to test `getNodes`.
    // If they are looking at `getRecords` (Files), then `users` won't show up if `users` is just a folder.

    // Let's assume `users` has a record at `["users"]`? Or just children?
    // If I add `add(["users", "user-1"])`, then `["users"]` is a folder.

    // Let's test `getNodes` logic equivalent.
  });

  async function getNodes(prefix: any[]) {
    const nodes: any[] = [];
    const depth = prefix.length;
    let currentStart = [...prefix];

    // Logic from getNodes
    // const END_SENTINEL = "\uFFFF\uFFFF\uFFFF\uFFFF"; // OLD
    // const END_SENTINEL = true; // NEW

    let useStart = false; // Initial fetch uses default unless verified

    while (true) {
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
      // console.log(`[getNodes] Found part: ${partVal}`);

      nodes.push(partVal);

      // Next start
      const nextStart = [...prefix, partVal, true];

      currentStart = nextStart;
      useStart = true;
    }
    return nodes;
  }

  await t.step("getNodes execution", async () => {
    const nodes = await getNodes([]);
    console.log("Nodes found:", nodes);
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
