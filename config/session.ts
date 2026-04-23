import {
  createSessionMiddleware,
  type SessionOptions,
} from "@innovatedev/fresh-session";
import { KvDexSessionStorage } from "@innovatedev/fresh-session/kvdex-store";
import type { State } from "@/utils.ts";
import { db } from "@/kv/db.ts";
import { rulesToPermissions } from "@/lib/permissions.ts";
import settings from "@/config/app.ts";

export const sessionConfig: SessionOptions = {
  store: new KvDexSessionStorage({
    // deno-lint-ignore no-explicit-any
    collection: db.sessions as any,
    // deno-lint-ignore no-explicit-any
    userCollection: db.users as any,
    expireAfter: 60 * 60 * 24 * 7, // 1 week
    // userIndex: "email", // Optional secondary index
  }),
  cookie: {
    name: "innokv.sid",
    httpOnly: true,
    secure: settings.env.isProd,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
  // Enable for Stateless API Token Support (e.g. "Authorization: Bearer <token>")
  verifyToken: async (tokenSecret) => {
    // Hash with SHA-256 to find
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(tokenSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const tokenDoc = await db.apiTokens.findByPrimaryIndex(
      "tokenHash",
      tokenHash,
    );

    if (!tokenDoc) return null;

    // Check expiration
    if (tokenDoc.value.expiresAt && new Date() > tokenDoc.value.expiresAt) {
      return null;
    }

    // Update lastUsedAt
    await db.apiTokens.update(tokenDoc.id, {
      ...tokenDoc.value,
      lastUsedAt: new Date(),
    });

    // Populate user
    const userDoc = await db.users.find(tokenDoc.value.userId);
    if (!userDoc) return null;

    return {
      id: userDoc.id,
      ...userDoc.value,
      permissions: tokenDoc.value.type === "scoped"
        ? rulesToPermissions(tokenDoc.value.rules)
        : userDoc.value.permissions,
    };
  },
  tokenPrefix: "Bearer ", // Optional (Default: "Bearer ")
};

export const session = createSessionMiddleware<State>(sessionConfig);
