/// <reference lib="deno.unstable" />
import { collection, kvdex, model } from "@olli/kvdex";
import { DatabaseModel } from "./models.ts";
import { dirname } from "jsr:@std/path@1.0.8";
import { SessionModel } from "./models.ts";
import { UserModel } from "./models.ts";
import settings from "@/config/app.ts";

const path = settings.db.path;
const dir = dirname(path);
await Deno.mkdir(dir, { recursive: true });
export const kv = await Deno.openKv(path);

import { APP_VERSION, InnoKvMetadata } from "./metadata.ts";
import { greaterThan, lessThan, parse } from "@std/semver";

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
      console.error(
        `CRITICAL: Database version (${metadata.version}) is newer than App version (${APP_VERSION}). Cannot start.`,
      );
      Deno.exit(1);
    } else if (lessThan(dbVersion, appVersion)) {
      console.log(
        `Migrating database from ${metadata.version} to ${APP_VERSION}...`,
      );
      metadata.version = APP_VERSION;
      await kv.set(["__innokv__"], metadata);
      console.log("Migration complete.");
    }
  } catch (e) {
    console.error("Failed to compare versions:", e);
    // Proceed with caution or exit? For now log error.
  }
}

export const ROOT_DB_ID = metadata.id;

export const db = kvdex({
  kv: kv,
  schema: {
    numbers: collection(model<number>()),
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
        createdAt: "secondary",
        updatedAt: "secondary",
        expiresAt: "secondary",
        userId: "secondary",
        ip: "secondary",
        userAgent: "secondary",
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
  },
});
