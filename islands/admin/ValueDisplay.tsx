import { useState } from "preact/hooks";

interface ValueDisplayProps {
  value: any;
  level?: number;
}

export function ValueDisplay({ value, level = 0 }: ValueDisplayProps) {
  const [expanded, setExpanded] = useState(level < 2);

  if (value === null) return <span class="text-error font-mono">null</span>;
  if (value === undefined) {
    return <span class="text-base-content/50 font-mono">undefined</span>;
  }

  if (typeof value === "boolean") {
    return <span class="text-warning font-mono">{value.toString()}</span>;
  }

  if (typeof value === "number") {
    return <span class="text-info font-mono">{value}</span>;
  }

  if (typeof value === "string") {
    // Check if it's an ISO date
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return (
          <span class="text-secondary font-mono">
            "{value}"{" "}
            <span class="text-base-content/50 text-xs">
              ({date.toLocaleString()})
            </span>
          </span>
        );
      }
    }
    return <span class="text-success font-mono">"{value}"</span>;
  }

  if (
    value instanceof Uint8Array ||
    (typeof value === "object" && value !== null &&
      Object.keys(value).length === 20 && "0" in value)
  ) {
    // Very basic heuristic for byte array if standard check fails, but instanceof usually works
    const arr = value instanceof Uint8Array ? value : Object.values(value);
    return <span class="text-accent font-mono">Uint8Array({arr.length})</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span class="text-base-content/50">[]</span>;

    return (
      <div class="ml-2">
        <div
          class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "▼" : "▶"} Array({value.length})
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {value.map((item, i) => (
              <div key={i} class="flex items-start gap-2">
                <span class="text-base-content/50 font-mono text-xs mt-1">
                  {i}:
                </span>
                <ValueDisplay value={item} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span class="text-base-content/50">{"{}"}</span>;
    }

    return (
      <div class="ml-2">
        <div
          class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "▼" : "▶"} Object
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {Object.entries(value).map(([k, v]) => (
              <div key={k} class="flex items-start gap-2">
                <span class="text-primary font-mono text-sm">{k}:</span>
                <ValueDisplay value={v} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}
