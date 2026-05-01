// deno-lint-ignore-file no-explicit-any
import { collection, kvdex } from "@olli/kvdex";
import {
  ApiTokenModel,
  AppConfigModel,
  AuditLogModel,
  DatabaseModel,
  SessionModel,
  UserModel,
} from "./models.ts";

const kv = await Deno.openKv();

// Get the root database ID from the metadata
const metadataKv = await Deno.openKv();
const metadataRes = await metadataKv.get(["metadata"]);
const metadata = metadataRes.value as { id: string } | null;
await metadataKv.close();

export const ROOT_DB_ID: string = metadata?.id || "root";

export const db: any = kvdex({
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
