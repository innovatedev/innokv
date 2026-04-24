import {
  createSessionMiddleware,
  type SessionOptions,
} from "@innovatedev/fresh-session";
import { KvDexSessionStorage } from "@innovatedev/fresh-session/kvdex-store";
import type { State } from "@/utils.ts";
import { SessionData, User } from "@/kv/models.ts";
import { db } from "@/kv/db.ts";
import { rulesToPermissions } from "@/lib/permissions.ts";
import settings from "@/config/app.ts";

export const sessionConfig: SessionOptions<User, SessionData> = {
  store: new KvDexSessionStorage<SessionData, User>({
    collection: db.sessions,
    userCollection: db.users,
    expireAfter: 60 * 60 * 24 * 7, // 1 week
    // userIndex: "email", // Optional secondary index
  }),
  cookie: {
    name: "innokv.sid",
    httpOnly: true,
    secure: settings.env.isProd,
    sameSite: "Lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
  // Enable for Stateless API Token Support (e.g. "Authorization: Bearer <token>")
  verifyToken: async (tokenSecret: string) => {
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

    if (!tokenDoc) return undefined;

    // Check expiration
    if (tokenDoc.value.expiresAt && new Date() > tokenDoc.value.expiresAt) {
      return undefined;
    }

    // Update lastUsedAt
    await db.apiTokens.update(tokenDoc.id, {
      ...tokenDoc.value,
      lastUsedAt: new Date(),
    });

    // Populate user
    const userDoc = await db.users.find(tokenDoc.value.userId);
    if (!userDoc) return undefined;

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
