import { useContext, useEffect, useState } from "preact/hooks";
import { DatabaseContext } from "./contexts/DatabaseContext.tsx";
import { RichValue, ValueCodec } from "@/codec/mod.ts";

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

  if (typeof value === "bigint") {
    return (
      <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
        <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
          BigInt
        </span>
        <span class="text-info font-mono text-xs">
          {String(value)}
          <span class="text-primary font-bold">n</span>
        </span>
      </div>
    );
  }

  if (typeof value === "number") {
    return <span class="text-info font-mono">{value}</span>;
  }

  if (value instanceof Date) {
    return (
      <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
        <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
          Date
        </span>
        <span class="text-secondary font-mono font-bold text-xs">
          {value.toLocaleString()}
          <span class="text-base-content/50 text-[10px] ml-1 font-normal">
            ({value.toISOString()})
          </span>
        </span>
      </div>
    );
  }

  if (value instanceof URL) {
    return (
      <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
        <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
          URL
        </span>
        <a
          href={value.href}
          target="_blank"
          class="text-info underline hover:text-primary font-mono text-xs break-all"
        >
          {value.href}
        </a>
      </div>
    );
  }

  if (value instanceof RegExp) {
    return (
      <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
        <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
          RegExp
        </span>
        <span class="text-secondary font-mono font-bold text-xs">
          /{value.source}/{value.flags}
        </span>
      </div>
    );
  }

  const DenoGlobal = (globalThis as unknown as { Deno?: { KvU64?: unknown } })
    .Deno;
  if (
    DenoGlobal?.KvU64 &&
    value instanceof (DenoGlobal.KvU64 as { new (...args: unknown[]): unknown })
  ) {
    return (
      <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
        <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
          KvU64
        </span>
        <span class="text-info font-mono font-bold text-xs">
          {String(value)}
        </span>
      </div>
    );
  }

  if (typeof value === "string") {
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
    value && typeof value === "object" && "type" in value &&
    (
      "value" in value ||
      (value as { type: string }).type === "undefined" ||
      (value as { type: string }).type === "null"
    )
  ) {
    const rich = value as { type: string; value?: unknown };

    if (rich.type === "undefined") {
      return (
        <span class="text-base-content/50 font-mono italic">undefined</span>
      );
    }

    if (rich.type === "null") {
      return <span class="text-error font-mono font-bold">null</span>;
    }

    // Types that we have specialized rendering for at the top of this function
    if (
      ["date", "URL", "regexp", "bigint"].includes(rich.type)
    ) {
      return <ValueDisplay value={ValueCodec.decode(rich as RichValue)} />;
    }

    if (rich.type === "KvU64") {
      return (
        <div class="inline-flex items-center border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1.5">
          <span class="text-[10px] font-bold opacity-50 uppercase tracking-wider">
            KvU64
          </span>
          <span class="text-info font-mono font-bold text-xs">
            {String(rich.value)}
          </span>
        </div>
      );
    }

    if (rich.type === "number") {
      if (
        rich.value === "NaN" || rich.value === "Infinity" ||
        rich.value === "-Infinity"
      ) {
        return <span class="text-info font-mono font-bold">{rich.value}</span>;
      }
      // For normal numbers, just show the number without a tag
      return <ValueDisplay value={rich.value} />;
    }

    if (rich.type === "string" || rich.type === "boolean") {
      // Just show the value without a tag for these primitives
      return <ValueDisplay value={rich.value} />;
    }

    // Special handling for binary data in RichValue to avoid it being treated as a plain array
    const isBinary = [
      "Uint8Array",
      "Int8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Uint16Array",
      "Int32Array",
      "Uint32Array",
      "Float32Array",
      "Float64Array",
      "BigInt64Array",
      "BigUint64Array",
      "ArrayBuffer",
      "DataView",
    ].includes(rich.type);

    if (isBinary) {
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

    if (rich.type === "Error") {
      const v = rich.value as { name: string; message: string; stack?: string };
      return (
        <div class="inline-flex flex-col border border-base-300 rounded px-1.5 py-0.5 bg-base-200/50 align-top leading-none gap-1">
          <div
            class="cursor-pointer hover:bg-base-300 inline-flex items-center px-1 rounded text-base-content select-none gap-1.5"
            onClick={toggleExpanded}
          >
            <span class="text-[10px] font-bold text-error uppercase tracking-wider">
              Error
            </span>
            <span class="font-mono text-xs font-bold">
              {v.name}: {v.message}
            </span>
            <span class="text-[10px] opacity-50">{expanded ? "▼" : "▶"}</span>
          </div>
          {expanded && v.stack && (
            <pre class="mt-1 text-[10px] opacity-70 whitespace-pre-wrap break-all bg-base-300/30 p-2 rounded max-w-2xl font-mono leading-relaxed">
              {v.stack}
            </pre>
          )}
        </div>
      );
    }

    return (
      <div class="inline-block border border-base-300 rounded px-1 bg-base-200/50 align-top">
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
