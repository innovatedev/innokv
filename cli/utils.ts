import { KeyCodec, ValueCodec } from "@/codec/mod.ts";

export function resolvePath(currentPath: unknown[], input?: string): unknown[] {
  if (!input) return [...currentPath];
  let newPath = [...currentPath];
  // Handle absolute path
  if (input.startsWith("/")) {
    newPath = [];
    // If it's just "/", we're done
    if (input === "/") return [];
    input = input.slice(1);
  }
  if (input.length > 0) {
    // KeyCodec.decode handles quoted strings and complex types correctly
    const apiParts = KeyCodec.decode(input);
    for (const part of apiParts) {
      if (part.type === "string" && part.value === "..") {
        newPath.pop();
      } else {
        const native = KeyCodec.toNative([part])[0];
        newPath.push(native);
      }
    }
  }
  return newPath;
}
export function formatValue(value: unknown, indent = 0): string {
  // If it's a RichValue, decode it for formatting
  // (e.g. for URL which is stored as RichValue)
  if (
    value && typeof value === "object" && "type" in value &&
    ValueCodec.isRichValue(value)
  ) {
    value = ValueCodec.decode(value);
  }

  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "bigint") return `${value}n`;
  const tag = Object.prototype.toString.call(value);
  if (value instanceof Date || tag === "[object Date]") {
    return `Date(${(value as Date).toISOString()})`;
  }
  if (value instanceof URL || tag === "[object URL]") {
    return `URL("${(value as URL).href}")`;
  }
  if (value instanceof RegExp || tag === "[object RegExp]") {
    const v = value as RegExp;
    return `RegExp(/${v.source}/${v.flags})`;
  }
  if (value instanceof Uint8Array) return `u8[${Array.from(value).join(",")}]`;

  const DenoGlobal = (globalThis as unknown as { Deno?: { KvU64?: unknown } })
    .Deno;
  if (
    DenoGlobal?.KvU64 &&
    value instanceof (DenoGlobal.KvU64 as { new (...args: unknown[]): unknown })
  ) {
    return `KvU64(${String(value)})`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const parts = value.map((v) => formatValue(v, indent + 2));
    return `[\n${" ".repeat(indent + 2)}${
      parts.join(`,\n${" ".repeat(indent + 2)}`)
    }\n${" ".repeat(indent)}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const parts = entries.map(([k, v]) =>
      `${JSON.stringify(k)}: ${formatValue(v, indent + 2)}`
    );
    return `{\n${" ".repeat(indent + 2)}${
      parts.join(`,\n${" ".repeat(indent + 2)}`)
    }\n${" ".repeat(indent)}}`;
  }

  return String(value);
}
