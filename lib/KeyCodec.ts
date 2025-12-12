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
          return `[${Array.from(bytes).join("~")}]`;
        } catch {
          return "[]";
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
        return { type: "string", value: token }; // Fallback
      }
    }
    if (token.endsWith("n")) {
      return { type: "bigint", value: token.slice(0, -1) };
    }
    if (token === "true" || token === "false") {
      return { type: "boolean", value: token }; // value matches "true"/"false" string
    }
    if (token.startsWith("[")) {
      try {
        const content = token.slice(1, -1);
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
    const num = Number(token);
    if (!isNaN(num)) {
      return { type: "number", value: token };
    }

    return { type: "string", value: token };
  }
}
