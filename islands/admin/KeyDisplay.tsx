export const KeyDisplay = (
  { type, value, prettyPrint = true }: {
    type: string;
    value: string | number | boolean | number[] | null;
    prettyPrint?: boolean;
  },
) => {
  const t = type?.toLowerCase() || "unknown";

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
    return <span class="font-mono text-accent">{String(value)}</span>;
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
      if (!Array.isArray(value)) {
        return (
          <span class="font-mono text-error opacity-50">
            [Invalid Uint8Array]
          </span>
        );
      }
      const bytes = new Uint8Array(value);
      const displayStr = Array.from(bytes).join(", ");

      if (prettyPrint) {
        try {
          const decoder = new TextDecoder();
          const str = decoder.decode(bytes);
          // Check for kvdex serialized date
          if (str.startsWith('{"__date__":"') && str.endsWith('"}')) {
            const data = JSON.parse(str);
            return (
              <span class="font-mono text-purple-400">{data.__date__}</span>
            );
          }
        } catch {
          // Not a string/date
        }
      }

      return (
        <span class="font-mono text-base-content/70">
          u8[{displayStr.length > 20
            ? displayStr.slice(0, 20) + "..."
            : displayStr}]
        </span>
      );
    } catch {
      return (
        <span class="font-mono text-base-content/70 opacity-50">
          [Binary Data]
        </span>
      );
    }
  }
  if (t === "array") {
    try {
      const arr = typeof value === "string" ? JSON.parse(value) : value;
      const str = JSON.stringify(arr, null, 1).replace(/\n/g, "").replace(
        /\s+/g,
        " ",
      );
      return (
        <span class="font-mono text-base-content/70">
          {str.length > 20 ? str.slice(0, 20) + "..." : str}
        </span>
      );
    } catch {
      return <span class="font-mono">{String(value)}</span>;
    }
  }
  return <span class="font-mono">{String(value)}</span>;
};
