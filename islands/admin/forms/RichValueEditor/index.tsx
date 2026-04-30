import { RichValue, RichValueType, ValueCodec } from "@/codec/mod.ts";
import { useEffect, useState } from "preact/hooks";

import { ObjectEditor } from "./ObjectEditor.tsx";
import { ArrayEditor } from "./ArrayEditor.tsx";
import { MapEditor } from "./MapEditor.tsx";
import { TypedArrayInput } from "./TypedArrayInput.tsx";
import { RegExpEditor } from "./RegExpEditor.tsx";
import { NumberInput } from "./NumberInput.tsx";
import { ErrorEditor } from "./ErrorEditor.tsx";

interface RichValueEditorProps {
  value: RichValue;
  onChange: (value: RichValue) => void;
  label?: string;
  depth?: number;
  isReadOnly?: boolean;
}

export default function RichValueEditor({
  value,
  onChange,
  label = "Value",
  depth = 0,
  isReadOnly = false,
}: RichValueEditorProps) {
  const [size, setSize] = useState<number | null>(null);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);

  // Derivied state directly from props to avoid sync issues
  const type = value.type;
  const val = value.value;

  const isContainerType = (t: RichValueType) =>
    ["object", "array", "map", "set"].includes(t);

  // Only collapse if it's nested AND it's a container
  // Primitives should be visible for quick editing
  const [collapsed, setCollapsed] = useState(
    depth > 0 && isContainerType(type),
  );

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      if (!active) return;

      // Client-side validation to avoid unnecessary/crashing server calls
      try {
        ValueCodec.decode(value);
      } catch (_err) {
        // Data is currently invalid (e.g. typing a URL), skip size calculation
        if (active) {
          setIsCalculatingSize(false);
          setSize(null);
        }
        return;
      }

      setIsCalculatingSize(true);
      try {
        const res = await fetch("/api/database/utils", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "calculate-size", value }),
        });
        if (res.ok) {
          const data = await res.json();
          if (active) setSize(data.size);
        } else {
          if (active) setSize(null);
        }
      } catch (err) {
        console.error("Failed to calculate size", err);
      } finally {
        if (active) setIsCalculatingSize(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [value]);

  const handleTypeChange = (newType: RichValueType) => {
    onChange({ type: newType, value: ValueCodec.getDefaultValue(newType) });
  };

  // deno-lint-ignore no-explicit-any
  const handlePrimitiveChange = (v: any) => {
    onChange({ type, value: v });
  };

  const isBinaryType = (t: string) =>
    [
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
    ].includes(t);

  return (
    <div
      class={`flex flex-col gap-2 p-2 border border-base-200 rounded-md ${
        depth > 0 ? "ml-4 bg-base-content/5" : "bg-base-100"
      }`}
    >
      <div class="flex items-center gap-2">
        {depth > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            class="btn btn-xs btn-ghost btn-square"
          >
            {collapsed ? "+" : "-"}
          </button>
        )}
        {label && <span class="font-bold text-xs opacity-70">{label}</span>}
        <select
          class="select select-bordered select-xs"
          value={type}
          disabled={isReadOnly}
          onChange={(e) =>
            handleTypeChange(
              (e.target as HTMLSelectElement).value as RichValueType,
            )}
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="bigint">BigInt</option>
          <option value="date">Date</option>
          <option value="regexp">RegExp</option>
          <optgroup label="Binary / TypedArrays">
            <option value="Uint8Array">Uint8Array</option>
            <option value="Int8Array">Int8Array</option>
            <option value="Uint8ClampedArray">Uint8ClampedArray</option>
            <option value="Int16Array">Int16Array</option>
            <option value="Uint16Array">Uint16Array</option>
            <option value="Int32Array">Int32Array</option>
            <option value="Uint32Array">Uint32Array</option>
            <option value="Float32Array">Float32Array</option>
            <option value="Float64Array">Float64Array</option>
            <option value="BigInt64Array">BigInt64Array</option>
            <option value="BigUint64Array">BigUint64Array</option>
            <option value="ArrayBuffer">ArrayBuffer</option>
            <option value="DataView">DataView</option>
          </optgroup>
          <optgroup label="Containers">
            <option value="object">Object</option>
            <option value="array">Array</option>
            <option value="map">Map</option>
            <option value="set">Set</option>
          </optgroup>
          <optgroup label="Special">
            <option value="null">Null</option>
            <option value="undefined">Undefined</option>
            <option value="Error">Error</option>
            <option value="KvU64">KvU64</option>
            <option value="URL">URL</option>
          </optgroup>
        </select>
        {size !== null && (
          <div
            class={`badge badge-ghost badge-xs gap-1 py-2 ${
              size > 65536 ? "badge-error text-white" : ""
            }`}
            title={size > 65536
              ? "Exceeds Deno KV 64KB limit!"
              : "V8 serialized size"}
          >
            {isCalculatingSize && (
              <span class="loading loading-spinner loading-xs"></span>
            )}
            {(size / 1024).toFixed(2)} KB
          </div>
        )}
      </div>

      {!collapsed && (
        <div class="mt-1">
          {type === "string" && (
            <textarea
              class="textarea textarea-bordered textarea-xs w-full max-w-lg rounded-2xl font-mono"
              rows={Math.min(5, (String(val) || "").split("\n").length + 1)}
              value={val as string}
              disabled={isReadOnly}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLTextAreaElement).value)}
            />
          )}
          {type === "number" && (
            <NumberInput
              value={val as number | string}
              disabled={isReadOnly}
              onChange={(v: number | string) => handlePrimitiveChange(v)}
            />
          )}
          {type === "bigint" && (
            <input
              type="text"
              class={`input input-bordered input-xs w-full max-w-xs font-mono ${
                val && !/^-?[0-9]+$/.test(String(val)) ? "input-error" : ""
              }`}
              pattern="-?[0-9]+"
              placeholder="e.g. 9007199254740991"
              value={val as string}
              disabled={isReadOnly}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLInputElement).value)}
            />
          )}
          {type === "boolean" && (
            <div class="flex items-center gap-2 px-2">
              <span class="text-xs opacity-70">Value:</span>
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                checked={val === true}
                disabled={isReadOnly}
                onChange={(e) =>
                  handlePrimitiveChange((e.target as HTMLInputElement).checked)}
              />
              <span class="text-xs font-bold">{val ? "true" : "false"}</span>
            </div>
          )}
          {type === "date" && (
            <input
              type="datetime-local"
              class="input input-bordered input-xs w-full max-w-xs"
              value={val
                ? new Date(val as string).toISOString().slice(0, 16)
                : ""}
              disabled={isReadOnly}
              onChange={(e) =>
                handlePrimitiveChange(
                  new Date((e.target as HTMLInputElement).value).toISOString(),
                )}
            />
          )}
          {type === "regexp" && (
            <RegExpEditor
              value={val}
              disabled={isReadOnly}
              onChange={(v) => handlePrimitiveChange(v)}
            />
          )}
          {type === "KvU64" && (
            <input
              type="text"
              class={`input input-bordered input-xs w-full max-w-xs font-mono ${
                val && !/^[0-9]+$/.test(String(val)) ? "input-error" : ""
              }`}
              pattern="[0-9]+"
              placeholder="Counter value"
              value={val as string}
              disabled={isReadOnly}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLInputElement).value)}
            />
          )}
          {type === "URL" && (
            <input
              type="url"
              class="input input-bordered input-xs w-full max-w-lg font-mono"
              value={val as string}
              disabled={isReadOnly}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLInputElement).value)}
            />
          )}
          {isBinaryType(type) && (
            <div class="flex flex-col gap-1">
              <span class="text-xs text-base-content/50">
                Comma separated values
              </span>
              <TypedArrayInput
                value={val as (number | string)[]}
                type={type}
                disabled={isReadOnly}
                onChange={(v) => handlePrimitiveChange(v)}
              />
            </div>
          )}
          {type === "object" && (
            <ObjectEditor
              value={val}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
              isReadOnly={isReadOnly}
            />
          )}
          {type === "array" && (
            <ArrayEditor
              value={val as RichValue[]}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
              isReadOnly={isReadOnly}
            />
          )}
          {type === "set" && (
            <ArrayEditor
              value={val as RichValue[]}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
              _isSet
              isReadOnly={isReadOnly}
            />
          )}
          {type === "map" && (
            <MapEditor
              value={val as [RichValue, RichValue][]}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
              isReadOnly={isReadOnly}
            />
          )}
          {type === "Error" && (
            <ErrorEditor
              value={val}
              isReadOnly={isReadOnly}
              onChange={(v) => handlePrimitiveChange(v)}
            />
          )}
          {(type === "undefined" || type === "null") && (
            <div class="text-xs italic opacity-50 p-1">{type}</div>
          )}
        </div>
      )}
    </div>
  );
}
