import { z } from "zod";
import { sessionSchemaFactory } from "@innovatedev/fresh-session/kvdex-store";

/**
 * Common types for the application.
 * These include the 'id' field as it's the most common use case
 * when working with retrieved records.
 */
export type User = z.infer<typeof UserModel> & { id: string };
export type Database = z.infer<typeof DatabaseModel> & { id: string };
export type Session = z.infer<typeof SessionModel> & { id: string };
export type ApiToken = z.infer<typeof ApiTokenModel> & { id: string };

/**
 * Base types representing strictly the value stored in Deno KV.
 * Use these when adding or updating records.
 */
export type UserValue = z.infer<typeof UserModel>;
export type DatabaseValue = z.infer<typeof DatabaseModel>;
export type SessionValue = z.infer<typeof SessionModel>;
export type ApiTokenValue = z.infer<typeof ApiTokenModel>;

// Compatibility aliases removed. Use User, Database, Session, ApiToken instead.

export const UserSettingsModel = z.object({
  databases: z.record(z.object({
    treeWidth: z.number().optional(),
    treeViewOpen: z.boolean().optional(),
  })).optional(),
  theme: z.string().optional(),
  prettyPrintDates: z.boolean().optional(),
  hideEmail: z.boolean().optional(),
});

export type UserSettings = z.infer<typeof UserSettingsModel>;

export const UserModel = z.object({
  username: z.string().optional(),
  email: z.string(),
  passwordHash: z.string(),
  lastLoginAt: z.date(),
  permissions: z.array(z.string()),
  settings: UserSettingsModel.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SessionModel = sessionSchemaFactory(z).extend({
  lastSeenAt: z.number().default(Date.now),
  data: z.object({
    settings: UserSettingsModel.optional(),
  }).catchall(z.any()).describe("Session data"),
});

export type SessionData = z.infer<typeof SessionModel>["data"];

export const ApiTokenModel = z.object({
  name: z.string(),
  userId: z.string(),
  tokenHash: z.string(),
  type: z.enum(["personal", "scoped"]),
  rules: z.array(z.object({
    effect: z.enum(["allow", "deny"]),
    scope: z.string(),
    permissions: z.object({
      read: z.boolean(),
      write: z.boolean(),
      manage: z.boolean().optional(),
    }),
  })),
  expiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  createdAt: z.date(),
});

export const DatabaseModel = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  path: z.string(),
  type: z.enum(["file", "memory", "remote"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastAccessedAt: z.date().optional(),
  lastError: z.string().optional(),
  lastErrorAt: z.date().optional(),
  accessToken: z.string().optional(),
  mode: z.enum(["r", "rw"]),
  sort: z.number().optional(),
  settings: z.object({
    prettyPrintDates: z.boolean().optional(),
  }).optional(),
});
