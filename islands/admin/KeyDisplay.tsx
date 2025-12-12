import { JSX } from "preact";

export const KeyDisplay = (
  { type, value }: { type: string; value: string },
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
  if (t === "uint8array") {
    try {
      const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      const str = Array.from(bytes).join(", ");
      return (
        <span class="font-mono text-base-content/70 text-xs">
          [{str.length > 20 ? str.slice(0, 20) + "..." : str}]
        </span>
      );
    } catch {
      return (
        <span class="font-mono text-base-content/70 text-xs">[{value}]</span>
      );
    }
  }
  return <span class="font-mono">{value}</span>;
};
