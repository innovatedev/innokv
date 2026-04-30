import { type Type, type } from "arktype";
import type { KvValue, Model } from "@olli/kvdex";

// --- Helper Types ---

// deno-lint-ignore no-explicit-any
export type KvModel<T> = Model<T, any> & {
  assert: (data: unknown) => T;
};

// deno-lint-ignore no-explicit-any
export const KvValueType = type("unknown") as Type<KvValue | any>;

// DateModel handles Date objects, ISO strings, and numbers (timestamps).
// It also allows null and undefined for optional fields.
export const DateModel = type("string | number | Date | null | undefined").pipe(
  (
    v,
  ) => (v === null || v === undefined
    ? v
    : v instanceof Date
    ? v
    : new Date(v)),
);

export const KvKeyPartModel: Type<Deno.KvKeyPart> = type(
  "string | number | boolean | bigint",
).or(
  type("unknown").narrow((data): data is Uint8Array =>
    data instanceof Uint8Array
  ),
);

export const KvKeyModel: Type<Deno.KvKey> = KvKeyPartModel.array();

// --- Base / Shared Models ---

const Timestamps = type({
  "createdAt?": DateModel,
  "updatedAt?": DateModel,
});

// --- User Models ---

export const UserSettingsModel = type({
  "databases?": KvValueType,
  "theme?": "string",
  "prettyPrintDates?": "boolean",
  "hideEmail?": "boolean",
}).and({ "[string]": KvValueType });

export type UserSettings = typeof UserSettingsModel.infer;

export const UserModel = type({
  "username?": "string",
  email: "string",
  passwordHash: "string",
  lastLoginAt: DateModel,
  permissions: "string[]",
  "settings?": UserSettingsModel,
}).and(Timestamps).and({ "[string]": KvValueType });

export type UserValue = typeof UserModel.infer;
export type User = UserValue & { id: string };

// --- Session Models ---

export const SessionModel = type({
  "userId?": "string",
  "flash?": KvValueType,
  "lastSeenAt?": DateModel,
  "ua?": "string",
  "ip?": "string",
  // Note: Application-specific session data (the 'data' key) is handled
  // by the index signature below to avoid double-nesting.
}).and(Timestamps).and({ "[string]": KvValueType });

export type SessionValue = typeof SessionModel.infer;
export type Session = SessionValue & { id: string };
export type SessionData = SessionValue["data"];

// --- API Token Models ---

const ApiTokenRule = type({
  effect: "'allow' | 'deny'",
  scope: "string",
  permissions: {
    read: "boolean",
    write: "boolean",
    "manage?": "boolean",
  },
});

export const ApiTokenModel = type({
  name: "string",
  userId: "string",
  tokenHash: "string",
  type: "'personal' | 'scoped'",
  rules: ApiTokenRule.array(),
  "lastUsedAt?": DateModel,
  "expiresAt?": DateModel,
}).and(Timestamps).and({ "[string]": KvValueType });

export type ApiTokenValue = typeof ApiTokenModel.infer;
export type ApiToken = ApiTokenValue & { id: string };

// --- Database Models ---

const DatabaseSettings = type({
  "prettyPrintDates?": "boolean",
  batchSize: "number",
  scanTimeout: "number",
});

const DatabaseStats = type({
  recordCount: "number",
  sizeBytes: "number",
  "updatedAt?": DateModel,
  "isPartial?": "boolean",
  "breakdown?": KvValueType,
  "topChildren?": type({
    key: KvValueType,
    size: "number",
    count: "number",
  }).array(),
});

export const DatabaseModel = type({
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
}).and(Timestamps).and({ "[string]": KvValueType });

export type DatabaseValue = typeof DatabaseModel.infer;
export type Database = DatabaseValue & { id: string };

// --- App Config Models ---

export const AppConfigModel = type({
  "port?": "number",
  "cookieName?": "string",
}).and(Timestamps).and({ "[string]": KvValueType });

export type AppConfigValue = typeof AppConfigModel.infer;
export type AppConfig = AppConfigValue & { id: string };

// --- Audit Log Models ---

export const AuditLogModel = type({
  "userId?": "string",
  databaseId: "string",
  action: "'set' | 'delete' | 'move' | 'copy' | 'import' | 'increment'",
  key: KvKeyModel,
  "oldValue?": KvValueType,
  "newValue?": KvValueType,
  "timestamp?": DateModel,
  "details?": KvValueType,
}).and({ "[string]": KvValueType });

export type AuditLogValue = typeof AuditLogModel.infer;
export type AuditLog = AuditLogValue & { id: string };
