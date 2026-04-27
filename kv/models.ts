import { type Type, type } from "arktype";
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
    // deno-lint-ignore no-explicit-any
    breakdown?: Record<string, any>;
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

/**
 * Validates any value that is natively supported by Deno KV.
 */
export const KvValueType: Type<KvValue> = type("unknown").narrow(
  (_data): _data is KvValue => true,
);

/**
 * Validates a single part of a Deno KV key.
 */
export const KvKeyPartModel: Type<Deno.KvKeyPart> = type(
  "string | number | boolean | bigint",
).or(
  type("unknown").narrow((data): data is Uint8Array =>
    data instanceof Uint8Array
  ),
);

/**
 * Validates a full Deno KV key.
 */
export const KvKeyModel: Type<Deno.KvKey> = KvKeyPartModel.array();

/**
 * Validates User Settings.
 */
export const UserSettingsModel: Type<UserSettings> = type({
  "databases?": "unknown",
  "theme?": "string",
  "prettyPrintDates?": "boolean",
  "hideEmail?": "boolean",
}).and({ "[string]": "unknown" }) as unknown as Type<UserSettings>;

/**
 * Validates a User record.
 */
export const UserModel: Type<UserValue> = type({
  "username?": "string",
  email: "string",
  passwordHash: "string",
  lastLoginAt: "Date",
  permissions: "string[]",
  "settings?": UserSettingsModel,
  createdAt: "Date",
  updatedAt: "Date",
}).and({ "[string]": "unknown" }) as unknown as Type<UserValue>;

/**
 * Validates a Session record.
 */
export const SessionModel: Type<SessionValue> = type({
  "userId?": "string",
  flash: "unknown",
  lastSeenAt: "number",
  "ua?": "string",
  "ip?": "string",
  data: "unknown",
}).and({ "[string]": "unknown" }) as unknown as Type<SessionValue>;

/**
 * Validates an API Token record.
 */
export const ApiTokenModel: Type<ApiTokenValue> = type({
  name: "string",
  userId: "string",
  tokenHash: "string",
  type: "'personal' | 'scoped'",
  rules: type({
    effect: "'allow' | 'deny'",
    scope: "string",
    permissions: {
      read: "boolean",
      write: "boolean",
      "manage?": "boolean",
    },
  }).array(),
  "expiresAt?": "Date",
  "lastUsedAt?": "Date",
  createdAt: "Date",
}).and({ "[string]": "unknown" }) as unknown as Type<ApiTokenValue>;

/**
 * Validates a Database record.
 */
export const DatabaseModel: Type<DatabaseValue> = type({
  slug: "string",
  name: "string",
  "description?": "string",
  path: "string",
  type: "'file' | 'memory' | 'remote'",
  createdAt: "Date",
  updatedAt: "Date",
  "lastAccessedAt?": "Date",
  "lastError?": "string",
  "lastErrorAt?": "Date",
  "accessToken?": "string",
  mode: "'r' | 'rw'",
  "sort?": "number",
  "settings?": {
    "prettyPrintDates?": "boolean",
    batchSize: "number",
    scanTimeout: "number",
  },
  "stats?": {
    recordCount: "number",
    sizeBytes: "number",
    updatedAt: "Date",
    "isPartial?": "boolean",
    "breakdown?": "unknown",
    // @ts-ignore: ArkType string keywords can be unresolvable in some contexts
    "topChildren?": type({
      key: "unknown",
      size: "number",
      count: "number",
    }).array(),
  },
}).and({ "[string]": "unknown" }) as unknown as Type<DatabaseValue>;

/**
 * Validates the global App Config record.
 */
export const AppConfigModel: Type<AppConfigValue> = type({
  "port?": "number",
  "cookieName?": "string",
  updatedAt: "Date",
}).and({ "[string]": "unknown" }) as unknown as Type<AppConfigValue>;

/**
 * Validates an Audit Log record.
 */
export const AuditLogModel: Type<AuditLogValue> = type({
  "userId?": "string",
  databaseId: "string",
  action: "'set' | 'delete' | 'move' | 'copy' | 'import' | 'increment'",
  key: "unknown",
  "oldValue?": "unknown",
  "newValue?": "unknown",
  timestamp: "Date",
  "details?": "unknown",
}).and({ "[string]": "unknown" }) as unknown as Type<AuditLogValue>;
