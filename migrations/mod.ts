import { greaterThan, lessThan, parse } from "@std/semver";

/**
 * Represents a single database migration.
 */
export interface Migration {
  /** The semver version this migration targets (e.g., "0.3.0") */
  version: string;
  /** A descriptive name for the migration */
  name: string;
  /** The function to execute the migration logic */
  run: (kv: Deno.Kv) => Promise<void>;
}

/**
 * Options for running migrations.
 */
export interface RunMigrationsOptions {
  /** The Deno.Kv instance to run migrations on */
  kv: Deno.Kv;
  /**
   * The current version stored in the database.
   * Optional if stateKey is provided (will be fetched from KV).
   */
  currentVersion?: string;
  /** The target version (usually the app version) */
  targetVersion: string;
  /** The list of available migrations */
  migrations: Migration[];
  /**
   * Optional key to store the migration state (version).
   * Can be a Deno.KvKey or a path string.
   */
  stateKey?: string | Deno.KvKey;
  /**
   * Optional function to parse a string path into a Deno.KvKey.
   * Required if stateKey is a string and the path uses a custom format.
   */
  parsePath?: (path: string) => Deno.KvKey;
  /** Optional callback when a migration starts */
  onMigrationStart?: (migration: Migration) => void;
  /** Optional callback when a migration completes successfully */
  onMigrationSuccess?: (migration: Migration) => void;
  /** Optional callback when a migration fails */
  onMigrationError?: (migration: Migration, error: Error) => void;
}

/**
 * Core migration engine that sorts and applies migrations sequentially.
 */
export async function runMigrations(options: RunMigrationsOptions) {
  const {
    kv,
    targetVersion,
    migrations,
    onMigrationStart,
    onMigrationSuccess,
    onMigrationError,
    parsePath,
  } = options;

  try {
    let currentVersion = options.currentVersion;
    const key = options.stateKey
      ? (typeof options.stateKey === "string"
        ? (parsePath ? parsePath(options.stateKey) : [options.stateKey])
        : options.stateKey)
      : null;

    // Fetch state from stateKey if provided
    let stateValue: unknown = null;
    if (key) {
      const res = await kv.get(key);
      stateValue = res.value;

      if (!currentVersion) {
        if (
          stateValue && typeof stateValue === "object" &&
          "version" in (stateValue as Record<string, unknown>)
        ) {
          currentVersion = (stateValue as Record<string, unknown>)
            .version as string;
        } else if (typeof stateValue === "string") {
          currentVersion = stateValue;
        }
      }
    }

    if (!currentVersion) {
      throw new Error(
        "currentVersion is required or must be available in stateKey",
      );
    }

    const dbVersion = parse(currentVersion);
    const appVersion = parse(targetVersion);

    if (lessThan(dbVersion, appVersion)) {
      const sortedMigrations = migrations
        .filter((m) => {
          try {
            const mVersion = parse(m.version);
            return greaterThan(mVersion, dbVersion) &&
              !greaterThan(mVersion, appVersion);
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          const va = parse(a.version);
          const vb = parse(b.version);
          if (lessThan(va, vb)) return -1;
          if (greaterThan(va, vb)) return 1;
          return 0;
        });

      if (sortedMigrations.length > 0) {
        for (const m of sortedMigrations) {
          onMigrationStart?.(m);
          try {
            await m.run(kv);
            onMigrationSuccess?.(m);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            onMigrationError?.(m, error);
            throw error;
          }
        }
      }

      // Update stateKey if provided
      if (key) {
        if (stateValue && typeof stateValue === "object") {
          await kv.set(key, { ...stateValue, version: targetVersion });
        } else {
          await kv.set(key, { version: targetVersion });
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

/**
 * Generic helper to load migrations from a directory.
 *
 * IMPORTANT: This uses Deno-specific file system APIs (`Deno.readDir`) and
 * only works on local file systems. It will fail if called from a remote
 * module (e.g., via JSR or https import).
 *
 * For JSR-compatible migration loading, use `discoverMigrations` with
 * static dynamic imports.
 */
export async function loadMigrationsFromDir(dir: string): Promise<Migration[]> {
  const migrations: Migration[] = [];

  for await (const entry of Deno.readDir(dir)) {
    if (
      entry.isFile &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
      entry.name !== "mod.ts" &&
      entry.name !== "index.ts"
    ) {
      // Use absolute path for import in Deno
      const path = new URL(`file://${dir}/${entry.name}`).href;
      const module = await import(/* @vite-ignore */ path);
      if (module.default && typeof module.default.run === "function") {
        migrations.push(module.default);
      }
    }
  }

  return migrations;
}

import { type } from "arktype";

/**
 * Validates a string follows semantic versioning.
 */
export const Semver = type("string").matching(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
);

/**
 * Basic compile-time SemVer check for TypeScript.
 */
export type SemverString = `${number}.${number}.${number}${string}`;

/**
 * Schema for the migrations map, enforcing SemVer keys.
 */
export const MigrationMap = type({
  "[string]": "unknown",
}).narrow((data, ctx) => {
  for (const key in data) {
    if (Semver(key) instanceof type.errors) {
      ctx.error({
        message: `Key '${key}' must be a valid SemVer string`,
        path: [key],
      });
    }
  }
  return true;
});

/**
 * The TypeScript type inferred from the MigrationMap schema.
 */
export type MigrationMap = Record<
  string,
  Promise<{ default: Omit<Migration, "version"> }>
>;

/**
 * Resolves a list of migrations from dynamic imports or a version map.
 * This allows defining migrations in separate files while maintaining
 * compatibility with environments that don't support runtime directory scanning (like JSR).
 *
 * @example
 * ```ts
 * // Array format (requires 'version' in each file)
 * const migrations = await discoverMigrations([
 *   import("./migrations/0.1.0.ts"),
 * ]);
 *
 * // Record format (injects version from key)
 * const migrations = await discoverMigrations({
 *   "0.1.0": import("./migrations/common/reset.ts"),
 * });
 * ```
 *
 * @param migrations An array of imports or a map of version strings to imports
 * @returns A promise that resolves to an array of Migration objects
 */
export async function discoverMigrations(
  migrations:
    | Record<
      string,
      Promise<{ default: Omit<Migration, "version"> }> | {
        default: Omit<Migration, "version">;
      }
    >
    | (Promise<{ default: Migration }> | { default: Migration })[],
): Promise<Migration[]> {
  if (Array.isArray(migrations)) {
    const resolved = await Promise.all(migrations);
    return resolved.map((m) => m.default);
  }

  // Validate the map structure and keys
  const validated = MigrationMap.assert(migrations) as MigrationMap;

  const entries = Object.entries(validated);
  const resolved = await Promise.all(entries.map(([_, p]) => p));
  return resolved.map((m, i) => ({
    ...(m.default as Migration),
    version: entries[i][0], // Override or set version from the map key
  }));
}
