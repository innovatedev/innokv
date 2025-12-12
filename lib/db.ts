/// <reference lib="deno.unstable" />
import { collection, kvdex, model } from "@olli/kvdex";
import { DatabaseModel } from "./models.ts";
import { dirname } from "jsr:@std/path@1.0.8";
import { SessionModel } from "./models.ts";
import { UserModel } from "./models.ts";

const path = Deno.env.get("KV_ADMIN_KV_PATH") ?? "data/innovatedev-admin.db";
const dir = dirname(path);
await Deno.mkdir(dir, { recursive: true });
export const kv = await Deno.openKv(path);

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
        id: "primary",
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
        id: "primary",
        createdAt: "secondary",
        updatedAt: "secondary",
        lastLoginAt: "secondary",
        email: "primary",
      },
    }),
  },
});
