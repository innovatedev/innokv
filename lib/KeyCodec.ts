import { ApiKvKeyPart } from "./types.ts";

export class KeyCodec {
  static encode(parts: ApiKvKeyPart[]): string {
    return parts.map((p) => this.encodePart(p)).join("~");
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
        } else if (char === "~") {
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
    switch (part.type.toLowerCase()) {
      case "string":
        return JSON.stringify(part.value);
      case "bigint":
        return `${part.value}n`;
      case "uint8array":
        try {
          const bytes = Uint8Array.from(
            atob(part.value),
            (c) => c.charCodeAt(0),
          );
          return `u8[${Array.from(bytes).join("~")}]`;
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
      return { type: "boolean", value: token }; // value matches "true"/"false" string
    }
    if (token.startsWith("u8[")) {
      try {
        const content = token.slice(3, -1);
        if (!content.trim()) return { type: "uint8array", value: btoa("") };
        const bytes = content.split("~").map((n) => parseInt(n.trim())).filter(
          (n) => !isNaN(n),
        );
        const u8 = new Uint8Array(bytes);
        const val = btoa(String.fromCharCode(...u8));
        return { type: "uint8array", value: val };
      } catch {
        return { type: "uint8array", value: btoa("") };
      }
    }
    if (token.startsWith("[")) {
      // Assume JSON array
      try {
        // JSON array doesn't map to a specific KV type in our simplified 'ApiKvKeyPart'
        // unless we add 'array' type.
        // But 'Database.ts' parseKeyPart handles 'Array' type using JSON.parse.
        // So we should return it as 'Array' type?
        // Database.ts: parseKeyPart handles 'Array'.
        // stringifyKeyPart -> { type: "Array", value: "[...]" }
        // KeyCodec.encode -> default -> "[...]"
        // Here we parse "[...]" -> we should return { type: "Array", value: token }
        return { type: "Array", value: token };
      } catch {
        return { type: "string", value: token };
      }
    }
    const num = Number(token);
    if (!isNaN(num)) {
      return { type: "number", value: token };
    }

    return { type: "string", value: token };
  }
}
