import { useContext, useEffect, useState } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";

interface ValueDisplayProps {
  value: unknown;
  level?: number;
  recursiveExpand?: boolean;
}

export function ValueDisplay(
  { value, level = 0, recursiveExpand: propRecursiveExpand }: ValueDisplayProps,
) {
  const { forceExpandValues } = useContext(DatabaseContext);
  const [expanded, setExpanded] = useState(level < 2);
  const [localRecursive, setLocalRecursive] = useState<boolean | undefined>(
    undefined,
  );

  // Sync with global signal
  useEffect(() => {
    if (forceExpandValues?.value !== undefined) {
      setExpanded(forceExpandValues.value);
      setLocalRecursive(forceExpandValues.value);
    }
  }, [forceExpandValues?.value]);

  // Sync with parent's recursive command
  useEffect(() => {
    if (propRecursiveExpand !== undefined) {
      setExpanded(propRecursiveExpand);
      setLocalRecursive(propRecursiveExpand);
    }
  }, [propRecursiveExpand]);

  const toggleExpanded = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
    setLocalRecursive(undefined); // Stop forcing children once user manually toggles
  };

  const handleRecursive = (e: MouseEvent, expand: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(expand);
    setLocalRecursive(expand);
  };

  const RecursiveToggle = () => (
    <button
      type="button"
      title={localRecursive === true
        ? "Recursive Collapse"
        : "Recursive Expand"}
      class="ml-1 px-1.5 rounded border border-base-300 hover:bg-base-300 text-xs font-bold opacity-50 hover:opacity-100 transition-colors"
      onClick={(e) => handleRecursive(e, localRecursive !== true)}
    >
      {localRecursive === true ? "«" : "»"}
    </button>
  );

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
    (Array.isArray(value) && value.length > 0 && typeof value[0] === "number" &&
      level === 0) // Heuristic for top-level decoded Uint8Array
  ) {
    const arr = value instanceof Uint8Array ? value : value;

    return (
      <div class="ml-2 inline-block align-top">
        <div
          class="cursor-pointer hover:bg-base-200 inline-flex items-center px-1 rounded text-base-content/70 select-none gap-1"
          onClick={toggleExpanded}
        >
          <span>
            {expanded ? "▼" : "▶"}{" "}
            {value instanceof Uint8Array ? "Uint8Array" : "u8[]"}({arr.length})
          </span>
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 font-mono text-xs break-all bg-base-200/30 p-2 rounded max-w-2xl">
            [{Array.from(arr).join(", ")}]
          </div>
        )}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span class="text-base-content/50">[]</span>;

    return (
      <div class="ml-2 inline-block align-top">
        <div class="flex items-center gap-1">
          <div
            class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
            onClick={toggleExpanded}
          >
            {expanded ? "▼" : "▶"} Array({value.length})
          </div>
          <RecursiveToggle />
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {value.map((item, i) => (
              <div key={i} class="flex items-start gap-2">
                <span class="text-base-content/50 font-mono text-xs mt-1">
                  {i}:
                </span>
                <ValueDisplay
                  value={item}
                  level={level + 1}
                  recursiveExpand={localRecursive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries());
    if (entries.length === 0) {
      return <span class="text-base-content/50">Map(0)</span>;
    }
    return (
      <div class="ml-2 inline-block align-top">
        <div class="flex items-center gap-1">
          <div
            class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
            onClick={toggleExpanded}
          >
            {expanded ? "▼" : "▶"} Map({value.size})
          </div>
          <RecursiveToggle />
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {entries.map(([k, v], i) => (
              <div key={i} class="flex items-start gap-2">
                <span class="text-primary font-mono text-sm flex items-start">
                  <ValueDisplay
                    value={k}
                    recursiveExpand={localRecursive}
                  />:
                </span>
                <ValueDisplay
                  value={v}
                  level={level + 1}
                  recursiveExpand={localRecursive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (value instanceof Set) {
    const items = Array.from(value);
    if (items.length === 0) {
      return <span class="text-base-content/50">Set(0)</span>;
    }
    return (
      <div class="inline-block align-top ml-2">
        <div class="flex items-center gap-1">
          <div
            class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
            onClick={toggleExpanded}
          >
            {expanded ? "▼" : "▶"} Set({value.size})
          </div>
          <RecursiveToggle />
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {items.map((item, i) => (
              <div key={i} class="flex items-start gap-2">
                <span class="text-base-content/50 font-mono text-xs mt-1">
                  {i}:
                </span>
                <ValueDisplay
                  value={item}
                  level={level + 1}
                  recursiveExpand={localRecursive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (
    value && typeof value === "object" && "type" in value && "value" in value
  ) {
    const rich = value as { type: string; value: unknown };

    // Special handling for binary data in RichValue to avoid it being treated as a plain array
    if (rich.type === "uint8array" || rich.type === "arraybuffer") {
      const arr = Array.isArray(rich.value) ? rich.value : [];
      return (
        <div class="inline-block border border-base-300 rounded px-1 bg-base-200/50 align-top">
          <div
            class="cursor-pointer hover:bg-base-200 inline-flex items-center px-1 rounded text-base-content/70 select-none gap-1"
            onClick={toggleExpanded}
          >
            <span class="text-xs font-bold opacity-50 mr-1">{rich.type}</span>
            <span>{expanded ? "▼" : "▶"} ({arr.length})</span>
          </div>
          {expanded && (
            <div class="border-l-2 border-base-300 pl-2 mt-1 font-mono text-xs break-all bg-base-200/30 p-2 rounded max-w-2xl">
              [{arr.join(", ")}]
            </div>
          )}
        </div>
      );
    }

    return (
      <div class="inline-block border border-base-300 rounded px-1 bg-base-200/50">
        <span class="text-xs font-bold opacity-50 mr-1">{rich.type}</span>
        <ValueDisplay
          value={rich.value}
          level={level}
          recursiveExpand={propRecursiveExpand}
        />
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span class="text-base-content/50">{"{}"}</span>;
    }

    return (
      <div class="inline-block align-top ml-2">
        <div class="flex items-center gap-1">
          <div
            class="cursor-pointer hover:bg-base-200 inline-block px-1 rounded text-base-content/70 select-none"
            onClick={toggleExpanded}
          >
            {expanded ? "▼" : "▶"} Object
          </div>
          <RecursiveToggle />
        </div>
        {expanded && (
          <div class="border-l-2 border-base-300 pl-2 mt-1 flex flex-col gap-1">
            {entries.map(([k, v]) => (
              <div key={k} class="flex items-start gap-2">
                <span class="text-primary font-mono text-sm">{k}:</span>
                <ValueDisplay
                  value={v}
                  level={level + 1}
                  recursiveExpand={localRecursive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}
