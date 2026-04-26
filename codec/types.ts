/**
 * Represents a single part of a Deno KV key in a JSON-serializable format.
 */
export type ApiKvKeyPart = {
  /** The type of the key part (e.g., "string", "number", "Uint8Array") */
  type: string;
  /** The value of the key part, serialized if necessary */
  value: string | number | boolean | number[] | null;
};

/**
 * A full Deno KV key represented as an array of JSON-serializable parts.
 */
export type ApiKvKey = ApiKvKeyPart[];

/**
 * A complete Deno KV entry in a JSON-serializable format.
 */
export type ApiKvEntry<T = unknown> = {
  /** The full key for the entry */
  key: ApiKvKey;
  /** The value stored in the entry */
  value: T;
  /** The versionstamp of the entry */
  versionstamp?: string;
  /** The size of the value in bytes (optional) */
  size?: number;
  /** The expiration time of the entry (if applicable) */
  expiresAt?: number | null;
};

/**
 * Supported types for rich value serialization.
 */
export type RichValueType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "undefined"
  | "null"
  | "object"
  | "array"
  | "map"
  | "set"
  | "date"
  | "regexp"
  | "Uint8Array"
  | "Int8Array"
  | "Uint8ClampedArray"
  | "Int16Array"
  | "Uint16Array"
  | "Int32Array"
  | "Uint32Array"
  | "Float32Array"
  | "Float64Array"
  | "BigInt64Array"
  | "BigUint64Array"
  | "ArrayBuffer"
  | "DataView"
  | "Error"
  | "KvU64"
  | "URL";

/**
 * A rich value representation for transport or storage in non-native contexts.
 */
export interface RichValue {
  /** The type of the value */
  type: RichValueType;
  /** The serialized transport format of the value */
  // deno-lint-ignore no-explicit-any
  value?: any;
}
