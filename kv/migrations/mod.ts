import { KeyCodec } from "@/codec/mod.ts";
import { APP_VERSION } from "@/lib/metadata.ts";
import {
  discoverMigrations,
  type Migration,
  runMigrations as runGenericMigrations,
} from "@/migrations/mod.ts";
export type { Migration };
import activeMigrations from "./active.ts";
/**
 * Runs migrations for the InnoKV application.
 *
 * @param kv The Deno.Kv instance
 * @param currentVersion Optional current version (fetched from __innokv__ if omitted)
 */
export async function runMigrations(kv: Deno.Kv, currentVersion?: string) {
  const migrations = await discoverMigrations(activeMigrations);
  await runGenericMigrations({
    kv,
    currentVersion,
    targetVersion: APP_VERSION,
    migrations,
    stateKey: "__innokv__",
    parsePath: (path) => KeyCodec.toNative(KeyCodec.decode(path)),
    onMigrationStart: (m) => {
      console.log(`Applying migration: ${m.version} - ${m.name}`);
    },
    onMigrationSuccess: (_m) => {
      console.log("Migration successful.");
    },
    onMigrationError: (m, err) => {
      console.error(`Migration ${m.version} failed:`, err);
    },
  });
}
