import { Migration } from "./mod.ts";

const migration: Migration = {
  version: "0.3.0",
  name: "Purge sessions due to schema change and bug",
  run: async (kv: Deno.Kv) => {
    console.log("Running migration 0.3.0: Purging sessions...");
    const prefix = ["__kvdex__", "sessions"];
    const iter = kv.list({ prefix });
    let count = 0;
    let atomic = kv.atomic();
    let batchCount = 0;

    for await (const entry of iter) {
      atomic.delete(entry.key);
      count++;
      batchCount++;

      if (batchCount >= 100) {
        await atomic.commit();
        atomic = kv.atomic();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await atomic.commit();
    }

    console.log(`Purged ${count} session entries.`);
  },
};

export default migration;
