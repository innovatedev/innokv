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
  | "uint8array"
  | "arraybuffer"; // TODO: handle other implementation specifics if needed

export interface RichValue {
  type: RichValueType;
  value?: any; // The serialized transport format
}

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
    if (val instanceof Uint8Array) {
      // Serialize as base64
      const binary = String.fromCharCode(...val);
      return { type: "uint8array", value: btoa(binary) };
    }
    if (val instanceof ArrayBuffer) {
      const u8 = new Uint8Array(val);
      const binary = String.fromCharCode(...u8);
      return { type: "arraybuffer", value: btoa(binary) };
    }
    if (val instanceof RegExp) {
      return {
        type: "regexp",
        value: { source: val.source, flags: val.flags },
      };
    }

    const tag = Object.prototype.toString.call(val);

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
        return new Date(encoded.value);
      case "uint8array":
        return Uint8Array.from(atob(encoded.value), (c) => c.charCodeAt(0));
      case "arraybuffer":
        return Uint8Array.from(atob(encoded.value), (c) => c.charCodeAt(0))
          .buffer;
      case "regexp":
        return new RegExp(encoded.value.source, encoded.value.flags);
      case "map":
        return new Map(encoded.value.map(([k, v]: [RichValue, RichValue]) => [
          ValueCodec.decode(k),
          ValueCodec.decode(v),
        ]));
      case "set":
        return new Set(
          encoded.value.map((v: RichValue) => ValueCodec.decode(v)),
        );
      case "array":
        return encoded.value.map((v: RichValue) => ValueCodec.decode(v));
      case "object": {
        const obj: Record<string, any> = {};
        for (const [k, v] of Object.entries(encoded.value)) {
          obj[k] = ValueCodec.decode(v as RichValue);
        }
        return obj;
      }
      default:
        return encoded.value;
    }
  }
}
