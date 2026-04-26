import { useState } from "preact/hooks";
import { RichValue, RichValueType } from "@/lib/ValueCodec.ts";
import { ObjectEditor } from "./ObjectEditor.tsx";
import { ArrayEditor } from "./ArrayEditor.tsx";
import { MapEditor } from "./MapEditor.tsx";
import { Uint8ArrayInput } from "./Uint8ArrayInput.tsx";

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
  // Derived state directly from props to avoid sync issues
  const type = value.type;
  const val = value.value;

  const isContainerType = (t: RichValueType) =>
    ["object", "array", "map", "set"].includes(t);

  // Only collapse if it's nested AND it's a container
  // Primitives should be visible for quick editing
  const [collapsed, setCollapsed] = useState(
    depth > 0 && isContainerType(type),
  );

  const handleTypeChange = (newType: RichValueType) => {
    // deno-lint-ignore no-explicit-any
    let newVal: any;

    // Default values for types
    switch (newType) {
      case "string":
        newVal = "";
        break;
      case "number":
        newVal = 0;
        break;
      case "bigint":
        newVal = "0";
        break;
      case "boolean":
        newVal = true;
        break;
      case "date":
        newVal = new Date().toISOString();
        break;
      case "Uint8Array":
        newVal = [];
        break;
      case "ArrayBuffer":
        newVal = [];
        break;
      case "object":
        newVal = {};
        break;
      case "array":
        newVal = [];
        break;
      case "map":
        newVal = [];
        break;
      case "set":
        newVal = [];
        break;
      case "null":
        newVal = null;
        break;
      case "undefined":
        newVal = undefined;
        break;
      default:
        newVal = "";
    }

    onChange({ type: newType, value: newVal });
  };

  // deno-lint-ignore no-explicit-any
  const handlePrimitiveChange = (v: any) => {
    onChange({ type, value: v });
  };

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
          <option value="Uint8Array">Uint8Array</option>
          <option value="ArrayBuffer">ArrayBuffer</option>
          <option value="object">Object</option>
          <option value="array">Array</option>
          <option value="map">Map</option>
          <option value="set">Set</option>
          <option value="null">Null</option>
          <option value="undefined">Undefined</option>
        </select>
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
            <input
              type="number"
              step="any"
              class="input input-bordered input-xs w-full max-w-xs"
              value={val as number}
              disabled={isReadOnly}
              onInput={(e) =>
                handlePrimitiveChange(
                  Number((e.target as HTMLInputElement).value),
                )}
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
          {(type === "Uint8Array" || type === "ArrayBuffer") && (
            <div class="flex flex-col gap-1">
              <span class="text-xs text-base-content/50">
                Comma separated bytes (0-255)
              </span>
              <Uint8ArrayInput
                value={val as number[]}
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
          {(type === "undefined" || type === "null") && (
            <div class="text-xs italic opacity-50 p-1">{type}</div>
          )}
        </div>
      )}
    </div>
  );
}
