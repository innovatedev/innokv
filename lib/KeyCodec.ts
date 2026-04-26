import { ApiKvKeyPart } from "./types.ts";

export class KeyCodec {
  static encode(parts: ApiKvKeyPart[]): string {
    return parts.map((p) => this.encodePart(p)).join("/");
  }

  /**
   * Converts a list of ApiKvKeyPart (transport format) to native Deno.KvKeyPart.
   */
  static toNative(parts: ApiKvKeyPart[]): Deno.KvKeyPart[] {
    return parts.map((p) => {
      const t = p.type.toLowerCase();
      if (t === "number") {
        return typeof p.value === "number"
          ? p.value
          : parseFloat(String(p.value));
      }
      if (t === "boolean") {
        return typeof p.value === "boolean"
          ? p.value
          : String(p.value) === "true";
      }
      if (t === "bigint") {
        return typeof p.value === "bigint" ? p.value : BigInt(String(p.value));
      }
      if (t === "uint8array") {
        if (p.value instanceof Uint8Array) return p.value;
        if (Array.isArray(p.value)) return new Uint8Array(p.value);
        if (typeof p.value === "string") {
          const bytes = p.value.split(/[,\s]+/)
            .map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
          return new Uint8Array(bytes);
        }
        return new Uint8Array();
      }
      return p.value as string;
    });
  }

  static decode(str: string): ApiKvKeyPart[] {
    const parts: ApiKvKeyPart[] = [];
    let current = "";
    let inString = false;
    let inArray = false;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (inString) {
        if (escape) {
          current += char;
          escape = false;
        } else if (char === "\\") {
          escape = true;
          current += char; // Keep escape for JSON.parse
        } else if (char === '"') {
          inString = false;
          current += char;
        } else {
          current += char;
        }
      } else if (inArray) {
        if (char === "]") {
          inArray = false;
          current += char;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inString = true;
          current += char;
        } else if (char === "[") {
          inArray = true;
          current += char;
        } else if (char === "/") {
          if (current.trim()) parts.push(this.parseToken(current.trim()));
          current = "";
          continue;
        } else {
          current += char;
        }
      }
    }
    if (current.trim()) parts.push(this.parseToken(current.trim()));
    return parts;
  }

  private static encodePart(part: ApiKvKeyPart): string {
    if (!part) {
      console.error("KeyCodec: received null/undefined part");
      return "undefined";
    }

    if (!part.type) {
      console.warn("KeyCodec: part missing type", part);
      return String(part.value || part);
    }

    switch (part.type.toLowerCase()) {
      case "string":
        return JSON.stringify(part.value);
      case "number":
      case "boolean":
        return String(part.value);
      case "bigint":
        return `${part.value}n`;
      case "uint8array":
      case "Uint8Array":
        try {
          if (!Array.isArray(part.value)) {
            return "u8[]";
          }
          const bytes = new Uint8Array(part.value);
          return `u8[${Array.from(bytes).join(",")}]`;
        } catch {
          return "u8[]";
        }
      default:
        return String(part.value);
    }
  }

  private static parseToken(token: string): ApiKvKeyPart {
    if (token.startsWith('"')) {
      try {
        return { type: "string", value: JSON.parse(token) };
      } catch {
        return { type: "string", value: token };
      }
    }
    if (token.endsWith("n")) {
      return { type: "bigint", value: token.slice(0, -1) };
    }
    if (token === "true" || token === "false") {
      return { type: "boolean", value: token === "true" };
    }
    if (token.startsWith("u8[")) {
      try {
        const content = token.slice(3, -1);
        if (!content.trim()) return { type: "Uint8Array", value: [] };
        const bytes = content.split(",").map((n) => parseInt(n.trim())).filter(
          (n) => !isNaN(n),
        );
        return { type: "Uint8Array", value: bytes };
      } catch {
        return { type: "Uint8Array", value: [] };
      }
    }
    const num = Number(token);
    if (token.trim() !== "" && (!isNaN(num) || token === "NaN")) {
      return { type: "number", value: num };
    }

    return { type: "string", value: token };
  }
}
