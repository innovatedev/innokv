import { KeyCodec } from "@/codec/mod.ts";

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
