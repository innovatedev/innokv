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

export interface RichValue {
  type: RichValueType;
  // deno-lint-ignore no-explicit-any
  value?: any; // The serialized transport format
}

const TYPED_ARRAYS = [
  Uint8Array,
  Int8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
];

export class ValueCodec {
  static encode(val: unknown): RichValue {
    if (val === undefined) return { type: "undefined" };
    if (val === null) return { type: "null" };

    const type = typeof val;

    if (type === "string") return { type: "string", value: val };
    if (type === "number") {
      if (Number.isNaN(val)) return { type: "number", value: "NaN" };
      if (val === Infinity) return { type: "number", value: "Infinity" };
      if (val === -Infinity) return { type: "number", value: "-Infinity" };
      return { type: "number", value: val };
    }
    if (type === "boolean") return { type: "boolean", value: val };
    if (type === "bigint") return { type: "bigint", value: String(val) };

    if (val instanceof Date) return { type: "date", value: val.toISOString() };
    if (val instanceof URL) return { type: "URL", value: val.href };

    for (const TA of TYPED_ARRAYS) {
      if (val instanceof TA) {
        return {
          type: TA.name as RichValueType,
          value: Array.from(val as unknown as ArrayLike<unknown>).map((v) =>
            typeof v === "bigint" ? String(v) : v
          ),
        };
      }
    }

    if (val instanceof ArrayBuffer) {
      return { type: "ArrayBuffer", value: Array.from(new Uint8Array(val)) };
    }
    if (val instanceof DataView) {
      return {
        type: "DataView",
        value: Array.from(
          new Uint8Array(val.buffer, val.byteOffset, val.byteLength),
        ),
      };
    }
    if (val instanceof RegExp) {
      return {
        type: "regexp",
        value: { source: val.source, flags: val.flags },
      };
    }
    if (val instanceof Error) {
      return {
        type: "Error",
        value: {
          name: val.name,
          message: val.message,
          stack: val.stack,
          cause: (val as { cause?: unknown }).cause
            ? ValueCodec.encode((val as { cause: unknown }).cause)
            : undefined,
        },
      };
    }

    const tag = Object.prototype.toString.call(val);

    // Deno specific types
    if (
      tag === "[object Deno.KvU64]" || (
        // deno-lint-ignore no-explicit-any
        typeof (globalThis as any).Deno !== "undefined" &&
        // deno-lint-ignore no-explicit-any
        val instanceof (globalThis as any).Deno.KvU64
      )
    ) {
      return { type: "KvU64", value: String((val as { value: bigint }).value) };
    }

    if (val instanceof Map || tag === "[object Map]") {
      const m = val as Map<unknown, unknown>;
      return {
        type: "map",
        value: Array.from(m.entries()).map(([k, v]) => [
          ValueCodec.encode(k),
          ValueCodec.encode(v),
        ]),
      };
    }
    if (val instanceof Set || tag === "[object Set]") {
      const s = val as Set<unknown>;
      return {
        type: "set",
        value: Array.from(s).map((v) => ValueCodec.encode(v)),
      };
    }
    if (Array.isArray(val)) {
      return {
        type: "array",
        value: val.map((v) => ValueCodec.encode(v)),
      };
    }
    if (type === "object") {
      const obj: Record<string, RichValue> = {};
      for (const [k, v] of Object.entries(val as object)) {
        obj[k] = ValueCodec.encode(v);
      }
      return { type: "object", value: obj };
    }

    // Fallback?
    return { type: "string", value: String(val) };
  }

  static decode(encoded: RichValue): unknown {
    switch (encoded.type) {
      case "undefined":
        return undefined;
      case "null":
        return null;
      case "string":
        return encoded.value;
      case "number":
        if (encoded.value === "NaN") return NaN;
        if (encoded.value === "Infinity") return Infinity;
        if (encoded.value === "-Infinity") return -Infinity;
        return Number(encoded.value);
      case "boolean":
        return Boolean(encoded.value);
      case "bigint":
        return BigInt(encoded.value);
      case "date":
        return new Date(encoded.value as string);
      case "Uint8Array":
        return new Uint8Array(encoded.value);
      case "Int8Array":
        return new Int8Array(encoded.value);
      case "Uint8ClampedArray":
        return new Uint8ClampedArray(encoded.value);
      case "Int16Array":
        return new Int16Array(encoded.value);
      case "Uint16Array":
        return new Uint16Array(encoded.value);
      case "Int32Array":
        return new Int32Array(encoded.value);
      case "Uint32Array":
        return new Uint32Array(encoded.value);
      case "Float32Array":
        return new Float32Array(encoded.value);
      case "Float64Array":
        return new Float64Array(encoded.value);
      case "BigInt64Array":
        return new BigInt64Array(encoded.value.map((v: string) => BigInt(v)));
      case "BigUint64Array":
        return new BigUint64Array(encoded.value.map((v: string) => BigInt(v)));
      case "ArrayBuffer":
        return new Uint8Array(encoded.value).buffer;
      case "DataView":
        return new DataView(new Uint8Array(encoded.value).buffer);
      case "regexp": {
        const v = encoded.value as { source: string; flags: string };
        return new RegExp(v.source, v.flags);
      }
      case "Error": {
        const v = encoded.value as {
          name: string;
          message: string;
          stack?: string;
          cause?: RichValue;
        };
        const error = new Error(v.message);
        error.name = v.name;
        error.stack = v.stack;
        if (v.cause) {
          // deno-lint-ignore no-explicit-any
          (error as any).cause = ValueCodec.decode(v.cause);
        }
        return error;
      }
      case "KvU64":
        // deno-lint-ignore no-explicit-any
        if (typeof (globalThis as any).Deno !== "undefined") {
          // deno-lint-ignore no-explicit-any
          return new (globalThis as any).Deno.KvU64(BigInt(encoded.value));
        }
        // Fallback for UI/Browser: just return the BigInt
        return BigInt(encoded.value);
      case "URL":
        return new URL(encoded.value as string);
      case "map":
        return new Map(
          (encoded.value as [RichValue, RichValue][]).map(([k, v]) => [
            ValueCodec.decode(k),
            ValueCodec.decode(v),
          ]),
        );
      case "set":
        return new Set(
          (encoded.value as RichValue[]).map((v) => ValueCodec.decode(v)),
        );
      case "array":
        return (encoded.value as RichValue[]).map((v) => ValueCodec.decode(v));
      case "object": {
        // deno-lint-ignore no-explicit-any
        const obj: Record<string, any> = {};
        for (
          const [k, v] of Object.entries(
            encoded.value as Record<string, RichValue>,
          )
        ) {
          obj[k] = ValueCodec.decode(v);
        }
        return obj;
      }
      default:
        return encoded.value;
    }
  }

  /**
   * Returns a default value for a given RichValueType.
   */
  // deno-lint-ignore no-explicit-any
  static getDefaultValue(type: RichValueType): any {
    switch (type) {
      case "string":
        return "";
      case "number":
        return 0;
      case "bigint":
        return "0";
      case "boolean":
        return true;
      case "date":
        return new Date().toISOString();
      case "regexp":
        return { source: "", flags: "" };
      case "Uint8Array":
      case "Int8Array":
      case "Uint8ClampedArray":
      case "Int16Array":
      case "Uint16Array":
      case "Int32Array":
      case "Uint32Array":
      case "Float32Array":
      case "Float64Array":
      case "BigInt64Array":
      case "BigUint64Array":
      case "ArrayBuffer":
      case "DataView":
        return [];
      case "object":
        return {};
      case "array":
        return [];
      case "map":
        return [];
      case "set":
        return [];
      case "null":
        return null;
      case "undefined":
        return undefined;
      case "KvU64":
        return "0";
      case "URL":
        return "https://";
      case "Error":
        return { name: "Error", message: "" };
      default:
        return "";
    }
  }
}
