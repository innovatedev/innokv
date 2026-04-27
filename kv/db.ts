import { collection, kvdex } from "@olli/kvdex";
import {
  ApiTokenModel,
  AppConfigModel,
  AuditLogModel,
  DatabaseModel,
  SessionModel,
  UserModel,
} from "@/kv/models.ts";
import { dirname } from "jsr:@std/path@1.0.8";
import settings from "@/config/app.ts";

const path = settings.db.path;
const dir = dirname(path);
await Deno.mkdir(dir, { recursive: true });
export const kv = await Deno.openKv(path);

import { APP_VERSION, InnoKvMetadata } from "@/lib/metadata.ts";
import { greaterThan, lessThan, parse } from "@std/semver";

import { runMigrations } from "@/kv/migrations/mod.ts";

const metadataRes = await kv.get<InnoKvMetadata>(["__innokv__"]);
let metadata = metadataRes.value;

if (!metadata) {
  metadata = {
    version: APP_VERSION,
    id: crypto.randomUUID(),
  };
  await kv.set(["__innokv__"], metadata);
  console.log(
    `Initialized InnoKV with ID: ${metadata.id}, Version: ${metadata.version}`,
  );
} else {
  try {
    const dbVersion = parse(metadata.version);
    const appVersion = parse(APP_VERSION);

    if (greaterThan(dbVersion, appVersion)) {
      console.warn(
        `WARNING: Database version (${metadata.version}) is newer than App version (${APP_VERSION}). This may cause issues.`,
      );
    } else if (lessThan(dbVersion, appVersion)) {
      console.log(
        `Migrating database from ${metadata.version} to ${APP_VERSION}...`,
      );

      await runMigrations(kv, metadata.version);

      console.log("Migration complete.");
    }
  } catch (e) {
    console.error("Failed to compare versions or run migrations:", e);
  }
}

export const ROOT_DB_ID = metadata.id;

export const db = kvdex({
  kv: kv,
  schema: {
    databases: collection(DatabaseModel, {
      indices: {
        slug: "primary",
        path: "secondary",
        name: "secondary",
        type: "secondary",
        createdAt: "secondary",
        updatedAt: "secondary",
        mode: "secondary",
        sort: "secondary",
      },
    }),
    sessions: collection(SessionModel, {
      indices: {
        expiresAt: "secondary",
        userId: "secondary",
      },
    }),
    users: collection(UserModel, {
      indices: {
        createdAt: "secondary",
        updatedAt: "secondary",
        lastLoginAt: "secondary",
        email: "primary",
      },
    }),
    apiTokens: collection(ApiTokenModel, {
      indices: {
        tokenHash: "primary",
        userId: "secondary",
        createdAt: "secondary",
        expiresAt: "secondary",
        lastUsedAt: "secondary",
        name: "secondary",
        type: "secondary",
      },
    }),
    config: collection(AppConfigModel),
    audit_logs: collection(AuditLogModel, {
      indices: {
        userId: "secondary",
        databaseId: "secondary",
        timestamp: "secondary",
        action: "secondary",
      },
    }),
  },
});
