export function resolvePath(currentPath: unknown[], input?: string): unknown[] {
  if (!input) return [...currentPath];

  let newPath = [...currentPath];

  // Handle absolute path
  if (input.startsWith("/")) {
    newPath = [];
    input = input.slice(1);
  }

  if (input.length > 0) {
    const parts = input.split("/");
    for (const rawPart of parts) {
      if (rawPart === "") continue;

      if (rawPart === "..") {
        newPath.pop();
        continue;
      }

      // Parse input part
      let part: unknown = rawPart;
      if (rawPart.startsWith('"') && rawPart.endsWith('"')) {
        part = rawPart.slice(1, -1);
      } else if (rawPart.endsWith("n")) {
        try {
          part = BigInt(rawPart.slice(0, -1));
        } catch (_e) { /* ignore */ }
      } else if (rawPart === "true") part = true;
      else if (rawPart === "false") part = false;
      else if (rawPart.startsWith("u8[") && rawPart.endsWith("]")) {
        try {
          const content = rawPart.slice(3, -1);
          if (content.trim()) {
            const bytes = content.split(",").map((n) => parseInt(n.trim()))
              .filter((n) => !isNaN(n));
            part = new Uint8Array(bytes);
          } else {
            part = new Uint8Array();
          }
        } catch (_e) { /* ignore */ }
      } else {
        const n = Number(rawPart);
        if (!isNaN(n)) part = n;
      }

      newPath.push(part);
    }
  }
  return newPath;
}
