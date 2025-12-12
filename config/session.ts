import {
  createSessionMiddleware,
  type SessionOptions,
} from "@innovatedev/fresh-session";
import { KvDexSessionStorage } from "./KvDexSessionStorage.ts";
import type { State } from "../utils.ts";
import { db } from "../lib/db.ts";

export const sessionConfig: SessionOptions = {
  // 7 days expiration, persistent in KV
  store: new KvDexSessionStorage({
    collection: db.sessions,
    userCollection: db.users,
    expireAfter: 60 * 60 * 24 * 7, // 1 week
    // userKeyPrefix: ["users"], // Uncomment to enable automatic user resolution
  }),
  cookie: {
    name: "sessionId",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export const session = createSessionMiddleware<State>(sessionConfig);
