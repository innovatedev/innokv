import { type } from "arktype";
import type { KvValue } from "@olli/kvdex";

/**
 * Common types for the application.
 * These include the 'id' field as it's the most common use case
 * when working with retrieved records.
 */
export type User = UserValue & { id: string };
export type Database = DatabaseValue & { id: string };
export type Session = SessionValue & { id: string };
export type ApiToken = ApiTokenValue & { id: string };
export type AuditLog = AuditLogValue & { id: string };

/**
 * Base types representing strictly the value stored in Deno KV.
 * Use these when adding or updating records.
 */

export interface UserSettings {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  // deno-lint-ignore no-explicit-any
  databases?: Record<string, any>;
  theme?: string;
  prettyPrintDates?: boolean;
  hideEmail?: boolean;
}

export interface UserValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  username?: string;
  email: string;
  passwordHash: string;
  lastLoginAt: Date;
  permissions: string[];
  settings?: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  settings?: UserSettings;
}

export interface SessionValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  userId?: string;
  // deno-lint-ignore no-explicit-any
  flash: Record<string, any>;
  lastSeenAt: number;
  ua?: string;
  ip?: string;
  data: SessionData;
}

export interface ApiTokenValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  name: string;
  userId: string;
  tokenHash: string;
  type: "personal" | "scoped";
  rules: {
    effect: "allow" | "deny";
    scope: string;
    permissions: {
      read: boolean;
      write: boolean;
      manage?: boolean;
    };
  }[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface DatabaseValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  slug: string;
  name: string;
  description?: string;
  path: string;
  type: "file" | "memory" | "remote";
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  lastError?: string;
  lastErrorAt?: Date;
  accessToken?: string;
  mode: "r" | "rw";
  sort?: number;
  settings?: {
    prettyPrintDates?: boolean;
    batchSize: number;
    scanTimeout: number;
  };
  stats?: {
    recordCount: number;
    sizeBytes: number;
    updatedAt: Date;
    isPartial?: boolean;
    breakdown?: Record<string, number>;
    topChildren?: {
      // deno-lint-ignore no-explicit-any
      key: any;
      size: number;
      count: number;
    }[];
  };
}

export interface AppConfigValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  port?: number;
  cookieName?: string;
  updatedAt: Date;
}

export type AppConfig = AppConfigValue & { id: string };

export interface AuditLogValue {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
  userId?: string;
  databaseId: string;
  action: "set" | "delete" | "move" | "copy" | "import" | "increment";
  // deno-lint-ignore no-explicit-any
  key: any;
  // deno-lint-ignore no-explicit-any
  oldValue?: any;
  // deno-lint-ignore no-explicit-any
  newValue?: any;
  timestamp: Date;
  // deno-lint-ignore no-explicit-any
  details?: Record<string, any>;
}

import type { Model } from "@olli/kvdex";
// deno-lint-ignore no-explicit-any
export type KvModel<T> = Model<T, any> & {
  assert: (data: unknown) => T;
};

// ================= ARKTYPE MODELS =================

export const KvValueType = type("unknown").narrow((_data): _data is KvValue =>
  true
);
export const KvKeyPartModel = type("string | number | boolean | bigint").or(
  type(["instanceof", Uint8Array]),
);
export const KvKeyModel = KvKeyPartModel.array();

export const UserSettingsModel = type({
  "databases?": type({
    "[string]": type({
      "treeWidth?": "number | undefined",
      "treeViewOpen?": "boolean | undefined",
    }),
  }).or("undefined"),
  "theme?": "string | undefined",
  "prettyPrintDates?": "boolean | undefined",
  "hideEmail?": "boolean | undefined",
});

export const UserModel = type({
  "username?": "string | undefined",
  email: "string",
  passwordHash: "string",
  lastLoginAt: "Date",
  permissions: "string[]",
  // deno-lint-ignore no-explicit-any
  "settings?": (UserSettingsModel as any).or("undefined"),
  createdAt: "Date",
  updatedAt: "Date",
});

export const SessionModel = type({
  "userId?": "string | undefined",
  flash: type({ "[string]": KvValueType }).default(() => ({})),
  lastSeenAt: type("number").default(() => Date.now()),
  "ua?": "string | undefined",
  "ip?": "string | undefined",
  data: type({
    // deno-lint-ignore no-explicit-any
    "settings?": (UserSettingsModel as any).or("undefined"),
    "[string]": KvValueType,
  }),
});

export const ApiTokenModel = type({
  name: "string",
  userId: "string",
  tokenHash: "string",
  type: "'personal' | 'scoped'",
  rules: type({
    effect: "'allow' | 'deny'",
    scope: "string",
    permissions: type({
      read: "boolean",
      write: "boolean",
      "manage?": "boolean | undefined",
    }),
  }).array(),
  "expiresAt?": "Date | undefined",
  "lastUsedAt?": "Date | undefined",
  createdAt: "Date",
});

export const DatabaseModel = type({
  slug: "string",
  name: "string",
  "description?": "string | undefined",
  path: "string",
  type: "'file' | 'memory' | 'remote'",
  createdAt: "Date",
  updatedAt: "Date",
  "lastAccessedAt?": "Date | undefined",
  "lastError?": "string | undefined",
  "lastErrorAt?": "Date | undefined",
  "accessToken?": "string | undefined",
  mode: "'r' | 'rw'",
  "sort?": "number | undefined",
  "settings?": type({
    "prettyPrintDates?": "boolean | undefined",
    batchSize: type("number").default(100),
    scanTimeout: type("number").default(30),
  }).or("undefined"),
  "stats?": type({
    recordCount: "number",
    sizeBytes: "number",
    updatedAt: "Date",
    "isPartial?": "boolean | undefined",
    "breakdown?": type({ "[string]": "number" }).or("undefined"),
    "topChildren?": type({
      key: KvValueType,
      size: "number",
      count: "number",
    }).array().or("undefined"),
  }).or("undefined"),
});

export const AppConfigModel = type({
  "port?": "number | undefined",
  "cookieName?": "string | undefined",
  updatedAt: "Date",
});

export const AuditLogModel = type({
  "userId?": "string | undefined",
  databaseId: "string",
  action: "'set' | 'delete' | 'move' | 'copy' | 'import' | 'increment'",
  key: KvKeyModel,
  "oldValue?": KvValueType.or("undefined"),
  "newValue?": KvValueType.or("undefined"),
  timestamp: "Date",
  "details?": type({ "[string]": KvValueType }).or("undefined"),
});
