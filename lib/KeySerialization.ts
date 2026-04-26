import { ApiKvKeyPart } from "./types.ts";

export class KeySerialization {
  static serialize(part: unknown): ApiKvKeyPart {
    // If already serialized, return as is (useful for client-side)
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      "value" in part
    ) {
      return part as ApiKvKeyPart;
    }

    if (typeof part === "string") {
      return { value: part, type: "string" };
    }
    if (typeof part === "number") {
      if (Number.isNaN(part)) return { value: "NaN", type: "number" };
      if (part === Infinity) return { value: "Infinity", type: "number" };
      if (part === -Infinity) return { value: "-Infinity", type: "number" };
      return { value: part, type: "number" };
    }
    if (typeof part === "boolean") {
      return { value: part, type: "boolean" };
    }
    if (typeof part === "bigint") {
      return { value: String(part), type: "bigint" };
    }
    if (part instanceof Uint8Array) {
      return { value: Array.from(part), type: "Uint8Array" };
    }

    return { value: String(part), type: "string" };
  }

  static parse(part: ApiKvKeyPart): Deno.KvKeyPart {
    switch (part.type) {
      case "string":
        return String(part.value);
      case "number":
        if (part.value === "NaN") return NaN;
        if (part.value === "Infinity") return Infinity;
        if (part.value === "-Infinity") return -Infinity;
        return typeof part.value === "number"
          ? part.value
          : parseFloat(String(part.value));
      case "boolean":
        return typeof part.value === "boolean"
          ? part.value
          : String(part.value) === "true";
      case "bigint":
        return BigInt(String(part.value));
      case "Uint8Array":
      case "uint8array":
        if (Array.isArray(part.value)) {
          return new Uint8Array(part.value) as unknown as Deno.KvKeyPart;
        }
        throw new Error("Uint8Array value must be an array of numbers");
      default:
        throw new Error(`Unsupported key part type: ${part.type}`);
    }
  }
}
