// deno-lint-ignore-file no-explicit-any
import { type Type, type } from "arktype";
import type { KvValue, Model } from "@olli/kvdex";

// --- Helper Types ---

/**
 * Wrapper for Kvdex models with an additional type-safe assertion method.
 */
export type KvModel<T> = Model<T, any> & {
  assert: (data: unknown) => T;
};

/**
 * Type representing any valid Deno KV value.
 */
export const KvValueType: Type<KvValue> = type("unknown") as unknown as Type<
  KvValue
>;

/**
 * Model for Date-like values.
 * Automatically coerces strings, numbers, or Date objects into Date objects.
 */
export const DateModel: Type<Date | null | undefined> = type(
  "string | number | Date | null | undefined",
).pipe(
  (
    v,
  ) => (v === null || v === undefined
    ? v
    : v instanceof Date
    ? v
    : new Date(v)),
) as unknown as Type<Date | null | undefined>;

/**
 * Model for a single segment of a Deno KV key.
 */
export const KvKeyPartModel: Type<any> = type(
  "string | number | boolean | bigint",
).or(
  type("unknown").narrow((data): data is Uint8Array =>
    data instanceof Uint8Array
  ),
) as unknown as Type<any>;

/**
 * Model for a complete Deno KV key.
 */
export const KvKeyModel: Type<any[]> = KvKeyPartModel
  .array() as unknown as Type<
    any[]
  >;

// --- Base / Shared Models ---

/**
 * Common timestamp fields for database models.
 */
export interface Timestamps {
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

/**
 * Model for common timestamp fields.
 */
export const Timestamps: Type<Timestamps> = type({
  "createdAt?": DateModel,
  "updatedAt?": DateModel,
}) as unknown as Type<Timestamps>;

// --- User Models ---

/**
 * Settings for a user.
 */
export interface UserSettings {
  databases?: any;
  theme?: string;
  prettyPrintDates?: boolean;
  hideEmail?: boolean;
  [key: string]: any;
}

/**
 * Model for user settings.
 */
export const UserSettingsModel: Type<UserSettings> = type({
  "databases?": KvValueType,
  "theme?": "string",
  "prettyPrintDates?": "boolean",
  "hideEmail?": "boolean",
}).and({ "[string]": KvValueType }) as unknown as Type<UserSettings>;

export type UserValue = {
  username?: string;
  email: string;
  passwordHash: string;
  lastLoginAt: Date | null | undefined;
  permissions: string[];
  settings?: UserSettings;
} & Timestamps;

/**
 * Model for a user record.
 */
export const UserModel: Type<UserValue> = type({
  "username?": "string",
  email: "string",
  passwordHash: "string",
  lastLoginAt: DateModel,
  permissions: "string[]",
  "settings?": UserSettingsModel,
}).and(Timestamps).and({ "[string]": KvValueType }) as unknown as Type<
  UserValue
>;

/**
 * A user record with its ID.
 */
export type User = UserValue & { id: string };

// --- Session Models ---

export type SessionValue = {
  userId?: string;
  flash?: any;
  lastSeenAt?: Date;
  ua?: string;
  ip?: string;
} & Timestamps;

/**
 * Model for a session record.
 */
export const SessionModel: Type<SessionValue> = type({
  "userId?": "string",
  "flash?": KvValueType,
  "lastSeenAt?": DateModel,
  "ua?": "string",
  "ip?": "string",
}).and(Timestamps).and({ "[string]": KvValueType }) as unknown as Type<
  SessionValue
>;

/**
 * A session record with its ID.
 */
export type Session = SessionValue & { id: string };

/**
 * Application-specific session data.
 */
export type SessionData = Record<string, any>;

// --- API Token Models ---

/**
 * A rule for an API token.
 */
export interface ApiTokenRule {
  effect: "allow" | "deny";
  scope: string;
  permissions: {
    read: boolean;
    write: boolean;
    manage?: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Model for an API token rule.
 */
export const ApiTokenRule: Type<ApiTokenRule> = type({
  effect: "'allow' | 'deny'",
  scope: "string",
  permissions: type({
    read: "boolean",
    write: "boolean",
    "manage?": "boolean",
  }).and({ "[string]": KvValueType }),
}).and({ "[string]": KvValueType }) as unknown as Type<ApiTokenRule>;

export type ApiTokenValue = {
  name: string;
  userId: string;
  tokenHash: string;
  type: "personal" | "scoped";
  rules: ApiTokenRule[];
  lastUsedAt?: Date;
  expiresAt?: Date;
} & Timestamps;

/**
 * Model for an API token record.
 */
export const ApiTokenModel: Type<ApiTokenValue> = type({
  name: "string",
  userId: "string",
  tokenHash: "string",
  type: "'personal' | 'scoped'",
  rules: ApiTokenRule.array(),
  "lastUsedAt?": DateModel,
  "expiresAt?": DateModel,
}).and(Timestamps).and({ "[string]": KvValueType }) as unknown as Type<
  ApiTokenValue
>;

export type ApiToken = ApiTokenValue & { id: string };

// --- Database Models ---

/**
 * Settings for a managed database.
 */
export interface DatabaseSettings {
  prettyPrintDates?: boolean;
  batchSize: number;
  scanTimeout: number;
  [key: string]: any;
}

/**
 * Model for database settings.
 */
export const DatabaseSettings: Type<DatabaseSettings> = type({
  "prettyPrintDates?": "boolean",
  batchSize: "number",
  scanTimeout: "number",
}).and({ "[string]": KvValueType }) as unknown as Type<DatabaseSettings>;

/**
 * Statistics for a database.
 */
export interface DatabaseStats {
  recordCount: number;
  sizeBytes: number;
  updatedAt?: Date;
  isPartial?: boolean;
  breakdown?: any;
  topChildren?: {
    key: any;
    size: number;
    count: number;
    [key: string]: any;
  }[];
  [key: string]: any;
}

/**
 * Model for database statistics.
 */
export const DatabaseStats: Type<DatabaseStats> = type({
  recordCount: "number",
  sizeBytes: "number",
  "updatedAt?": DateModel,
  "isPartial?": "boolean",
  "breakdown?": KvValueType,
  "topChildren?": type({
    key: KvValueType,
    size: "number",
    count: "number",
  }).and({ "[string]": KvValueType }).array(),
}).and({ "[string]": KvValueType }) as unknown as Type<DatabaseStats>;

export type DatabaseValue = {
  slug: string;
  name: string;
  description?: string;
  path: string;
  type: "file" | "memory" | "remote";
  lastAccessedAt?: Date;
  accessToken?: string;
  mode: "r" | "rw";
  sort?: number;
  settings?: DatabaseSettings;
  stats?: DatabaseStats;
} & Timestamps;

/**
 * Model for a database record.
 */
export const DatabaseModel: Type<DatabaseValue> = type({
  slug: "string",
  name: "string",
  "description?": "string",
  path: "string",
  type: "'file' | 'memory' | 'remote'",
  "lastAccessedAt?": DateModel,
  "accessToken?": "string",
  mode: "'r' | 'rw'",
  "sort?": "number",
  "settings?": DatabaseSettings,
  "stats?": DatabaseStats,
}).and(Timestamps).and({ "[string]": KvValueType }) as unknown as Type<
  DatabaseValue
>;

export type Database = DatabaseValue & { id: string };

// --- App Config Models ---

export type AppConfigValue = {
  port?: number;
  cookieName?: string;
} & Timestamps;

/**
 * Model for application configuration.
 */
export const AppConfigModel: Type<AppConfigValue> = type({
  "port?": "number",
  "cookieName?": "string",
}).and(Timestamps).and({ "[string]": KvValueType }) as unknown as Type<
  AppConfigValue
>;

export type AppConfig = AppConfigValue & { id: string };

// --- Audit Log Models ---

export type AuditLogValue = {
  userId?: string;
  databaseId: string;
  action: "set" | "delete" | "move" | "copy" | "import" | "increment";
  key: any[];
  oldValue?: any;
  newValue?: any;
  timestamp?: Date;
  details?: any;
  [key: string]: any;
};

/**
 * Model for an audit log entry.
 */
export const AuditLogModel: Type<AuditLogValue> = type({
  "userId?": "string",
  databaseId: "string",
  action: "'set' | 'delete' | 'move' | 'copy' | 'import' | 'increment'",
  key: KvKeyModel,
  "oldValue?": KvValueType,
  "newValue?": KvValueType,
  "timestamp?": DateModel,
  "details?": KvValueType,
}).and({ "[string]": KvValueType }) as unknown as Type<AuditLogValue>;

export type AuditLog = AuditLogValue & { id: string };
