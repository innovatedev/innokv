export const KeyDisplay = (
  { type, value, prettyPrint = true }: {
    type: string;
    value: string;
    prettyPrint?: boolean;
  },
) => {
  const t = type.toLowerCase();

  if (t === "string") {
    return (
      <span class="font-mono">
        <span class="text-neutral-content/50 opacity-50">"</span>
        <span class="text-secondary">{value}</span>
        <span class="text-neutral-content/50 opacity-50">"</span>
      </span>
    );
  }
  if (t === "number") return <span class="font-mono text-info">{value}</span>;
  if (t === "boolean") {
    return <span class="font-mono text-accent">{value}</span>;
  }
  if (t === "bigint") {
    return (
      <span class="font-mono text-warning text-sm">
        {value}
        <span class="text-neutral-content/50 opacity-50">n</span>
      </span>
    );
  }

  // ... (string/number/boolean/bigint handlers unchanged)

  if (t === "uint8array") {
    try {
      const charCodes = atob(value).split("").map((c) => c.charCodeAt(0));
      const bytes = new Uint8Array(charCodes);

      if (prettyPrint) {
        // Check for TextDecoder compatibility or just generic JSON parsing check if it's text
        // We assume it's UTF-8
        const decoder = new TextDecoder();
        const str = decoder.decode(bytes);

        // Check for kvdex serialized date: {"__date__":"..."}
        if (str.startsWith('{"__date__":"') && str.endsWith('"}')) {
          try {
            const data = JSON.parse(str);
            return (
              <span class="font-mono text-purple-400">{data.__date__}</span>
            );
          } catch {
            // ignore
          }
        }
      }

      const displayStr = Array.from(bytes).join(", ");
      return (
        <span class="font-mono text-base-content/70 text-xs">
          u8[{displayStr.length > 20
            ? displayStr.slice(0, 20) + "..."
            : displayStr}]
        </span>
      );
    } catch {
      return (
        <span class="font-mono text-base-content/70 text-xs">[{value}]</span>
      );
    }
  }
  if (t === "array") {
    try {
      const arr = JSON.parse(value);
      const str = JSON.stringify(arr, null, 1).replace(/\n/g, "").replace(
        /\s+/g,
        " ",
      );
      return (
        <span class="font-mono text-base-content/70 text-xs">
          {str.length > 20 ? str.slice(0, 20) + "..." : str}
        </span>
      );
    } catch {
      return <span class="font-mono">{value}</span>;
    }
  }
  return <span class="font-mono">{value}</span>;
};
