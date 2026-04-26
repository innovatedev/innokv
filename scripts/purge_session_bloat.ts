import { kv } from "../kv/db.ts";

/**
 * Maintenance script to purge leaked secondary index keys for sessions.
 * These were caused by a bug where old index entries were not being cleaned up
 * during rapid session updates.
 */

async function purgeBloat() {
  console.log("Scanning for session index bloat...");
  let count = 0;

  // Prefixes for indices we removed or that are causing bloat
  const targets = ["updatedAt", "createdAt", "ip", "userAgent"];

  for (const target of targets) {
    const prefix = ["__kvdex__", "sessions", "__index_secondary__", target];
    const iter = kv.list({ prefix });

    for await (const entry of iter) {
      await kv.delete(entry.key);
      count++;
      if (count % 1000 === 0) {
        console.log(`Purged ${count} orphaned index keys...`);
      }
    }
  }

  console.log(`Done! Purged a total of ${count} orphaned session index keys.`);
}

if (import.meta.main) {
  await purgeBloat();
  Deno.exit(0);
}
