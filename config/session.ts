import {
  createSessionMiddleware,
  type SessionOptions,
} from "@innovatedev/fresh-session";
import { KvDexSessionStorage } from "@innovatedev/fresh-session/kvdex-store";
import type { State } from "@/utils.ts";
import { db } from "@/lib/db.ts";

export const sessionConfig: SessionOptions = {
  // 7 days expiration, persistent in KV
  store: new KvDexSessionStorage({
    collection: db.sessions,
    userCollection: db.users,
    expireAfter: 60 * 60 * 24 * 7, // 1 week
  }),
  cookie: {
    name: "sessionId",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
  trackIp: true,
  trackUserAgent: true,
};

export const session = createSessionMiddleware<State>(sessionConfig);
