import { useEffect, useRef, useState } from "preact/hooks";
import { RichValue, RichValueType } from "@/lib/ValueCodec.ts";

interface RichValueEditorProps {
  value: RichValue;
  onChange: (value: RichValue) => void;
  label?: string;
  depth?: number;
}

export default function RichValueEditor({
  value,
  onChange,
  label = "Value",
  depth = 0,
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
      case "uint8array":
        newVal = "";
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
      case "undefined":
        newVal = undefined;
        break;
      case "null":
        newVal = null;
        break;
      default:
        newVal = "";
    }

    onChange({ type: newType, value: newVal });
  };

  const handlePrimitiveChange = (v: any) => {
    onChange({ type, value: v });
  };

  // Reuse our check
  const isContainer = isContainerType(type);

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
          <option value="uint8array">Uint8Array</option>
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
              class="textarea textarea-bordered textarea-sm w-full max-w-lg rounded-2xl font-mono"
              rows={Math.min(5, (String(val) || "").split("\n").length + 1)}
              value={val}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLTextAreaElement).value)}
            />
          )}
          {type === "number" && (
            <input
              type="number"
              step="any"
              class="input input-bordered input-sm w-full max-w-xs"
              value={val}
              onInput={(e) =>
                handlePrimitiveChange(
                  Number((e.target as HTMLInputElement).value),
                )}
            />
          )}
          {type === "bigint" && (
            <input
              type="text"
              class="input input-bordered input-sm w-full max-w-xs font-mono"
              pattern="-?[0-9]+"
              placeholder="e.g. 9007199254740991"
              value={val}
              onInput={(e) =>
                handlePrimitiveChange((e.target as HTMLInputElement).value)}
            />
          )}
          {type === "boolean" && (
            <div class="flex gap-4">
              <label class="label cursor-pointer gap-2">
                <span class="label-text">True</span>
                <input
                  type="radio"
                  name={`bool-${Math.random()}`}
                  class="radio radio-sm"
                  checked={val === true}
                  onChange={() => handlePrimitiveChange(true)}
                />
              </label>
              <label class="label cursor-pointer gap-2">
                <span class="label-text">False</span>
                <input
                  type="radio"
                  name={`bool-${Math.random()}`}
                  class="radio radio-sm"
                  checked={val === false}
                  onChange={() => handlePrimitiveChange(false)}
                />
              </label>
            </div>
          )}
          {type === "date" && (
            <input
              type="datetime-local"
              class="input input-bordered input-sm w-full max-w-xs"
              value={val ? new Date(val).toISOString().slice(0, 16) : ""}
              onChange={(e) =>
                handlePrimitiveChange(
                  new Date((e.target as HTMLInputElement).value).toISOString(),
                )}
            />
          )}
          {type === "uint8array" && (
            // Assuming base64 input or simplified comma separated?
            // The codec expects base64. Let's provide a text helper.
            // We'll let user input comma separated list and convert to base64.
            <div class="flex flex-col gap-1">
              <span class="text-xs text-base-content/50">
                Comma separated bytes (0-255)
              </span>
              <Uint8ArrayInput
                value={val}
                onChange={(v) => handlePrimitiveChange(v)}
              />
            </div>
          )}
          {type === "object" && (
            <ObjectEditor
              value={val}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
            />
          )}
          {type === "array" && (
            <ArrayEditor
              value={val}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
            />
          )}
          {type === "set" && (
            <ArrayEditor
              value={val}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
              isSet
            />
          )}
          {type === "map" && (
            <MapEditor
              value={val}
              onChange={(newVal) => handlePrimitiveChange(newVal)}
              depth={depth + 1}
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

function ObjectEditor(
  { value, onChange, depth }: {
    value: any;
    onChange: (v: any) => void;
    depth: number;
  },
) {
  const entries = Object.entries(value || {});
  const [newKey, setNewKey] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyName, setEditKeyName] = useState("");

  const addField = (e: Event) => {
    e.preventDefault();
    if (newKey && !(newKey in (value || {}))) {
      onChange({ ...value, [newKey]: { type: "string", value: "" } });
      setNewKey("");
      setIsAdding(false);
    }
  };

  const removeField = (key: string) => {
    const newValue = { ...value };
    delete newValue[key];
    onChange(newValue);
  };

  const updateField = (key: string, newVal: RichValue) => {
    onChange({ ...value, [key]: newVal });
  };

  const startEditing = (key: string) => {
    setEditingKey(key);
    setEditKeyName(key);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditKeyName("");
  };

  const saveKey = (oldKey: string) => {
    if (editKeyName === oldKey) {
      cancelEditing();
      return;
    }
    if (editKeyName && !(editKeyName in (value || {}))) {
      const val = value[oldKey];
      const newValue = { ...value };
      delete newValue[oldKey];
      newValue[editKeyName] = val;
      // Preserve order? It's hard with just object.
      // JS objects iterate in insertion order usually, but reconstructing it might append to end.
      // For now, accept that renaming might move it to the end.
      onChange(newValue);
      cancelEditing();
    } else {
      alert("Key already exists or is empty");
    }
  };

  return (
    <div class="flex flex-col gap-2">
      {entries.map(([key, val]) => (
        <div
          key={key}
          class="flex flex-col gap-1 pl-2 border-l border-base-300"
        >
          <div class="flex items-center justify-between">
            {editingKey === key
              ? (
                <div class="flex gap-2 items-center flex-1">
                  <input
                    type="text"
                    class="input input-xs input-bordered max-w-xs"
                    value={editKeyName}
                    onInput={(e) =>
                      setEditKeyName((e.target as HTMLInputElement).value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveKey(key);
                      if (e.key === "Escape") cancelEditing();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveKey(key)}
                    class="btn btn-xs btn-success"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    class="btn btn-xs btn-ghost"
                  >
                    ✕
                  </button>
                </div>
              )
              : (
                <span
                  class="font-bold text-sm bg-base-200 px-2 py-0.5 rounded cursor-text hover:bg-base-300 transition-colors"
                  onClick={() => startEditing(key)}
                  title="Click to rename"
                >
                  {key}
                </span>
              )}
            <button
              type="button"
              onClick={() => removeField(key)}
              class="btn btn-xs btn-ghost text-error"
            >
              Remove
            </button>
          </div>
          <RichValueEditor
            value={val as RichValue}
            onChange={(v) => updateField(key, v)}
            depth={depth}
          />
        </div>
      ))}

      {isAdding
        ? (
          <div class="flex gap-2 items-center">
            <input
              type="text"
              class="input input-bordered input-xs"
              placeholder="Field name"
              value={newKey}
              onInput={(e) => setNewKey((e.target as HTMLInputElement).value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addField(e);
                if (e.key === "Escape") setIsAdding(false);
              }}
            />
            <button
              type="button"
              class="btn btn-xs btn-primary"
              onClick={addField}
              disabled={!newKey || (newKey in (value || {}))}
            >
              Add
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </div>
        )
        : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class="btn btn-xs btn-outline self-start"
          >
            + Add Field
          </button>
        )}
    </div>
  );
}

function ArrayEditor(
  { value, onChange, depth, isSet }: {
    value: any[];
    onChange: (v: any) => void;
    depth: number;
    isSet?: boolean;
  },
) {
  // value is array of RichValue
  const list = value || [];

  const addItem = () => {
    onChange([...list, { type: "string", value: "" }]);
  };

  const removeItem = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, newVal: RichValue) => {
    const newList = [...list];
    newList[idx] = newVal;
    onChange(newList);
  };

  return (
    <div class="flex flex-col gap-2">
      {list.map((val, idx) => (
        <div
          key={idx}
          class="flex flex-col gap-1 pl-2 border-l border-base-300"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs opacity-50">Item {idx}</span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              class="btn btn-xs btn-ghost text-error"
            >
              Remove
            </button>
          </div>
          <RichValueEditor
            value={val}
            onChange={(v) => updateItem(idx, v)}
            depth={depth}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        class="btn btn-xs btn-outline self-start"
      >
        + Add Item
      </button>
    </div>
  );
}

function MapEditor(
  { value, onChange, depth }: {
    value: [RichValue, RichValue][];
    onChange: (v: any) => void;
    depth: number;
  },
) {
  // value is array of [Key(RichValue), Value(RichValue)]
  const list = value || [];

  const addItem = () => {
    onChange([...list, [{ type: "string", value: "key" }, {
      type: "string",
      value: "value",
    }]]);
  };

  const removeItem = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  const updateEntry = (
    idx: number,
    type: "key" | "value",
    newVal: RichValue,
  ) => {
    const newList = [...list];
    // newList[idx] is [k, v]
    const pair = [...newList[idx]] as [RichValue, RichValue];
    pair[type === "key" ? 0 : 1] = newVal;
    newList[idx] = pair;
    onChange(newList);
  };

  return (
    <div class="flex flex-col gap-2">
      {list.map((val, idx) => (
        <div
          key={idx}
          class="p-2 border border-base-300 rounded bg-base-200 flex flex-col gap-2"
        >
          <div class="flex justify-between items-center text-xs opacity-70">
            <span>Entry {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              class="text-error hover:underline"
            >
              Remove
            </button>
          </div>
          <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <RichValueEditor
              value={val[0]}
              onChange={(v) => updateEntry(idx, "key", v)}
              depth={depth + 1}
              label="Key"
            />
            <span class="mt-8 text-base-content/50">→</span>
            <RichValueEditor
              value={val[1]}
              onChange={(v) => updateEntry(idx, "value", v)}
              depth={depth + 1}
              label="Value"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        class="btn btn-xs btn-outline self-start"
      >
        + Add Entry
      </button>
    </div>
  );
}

function Uint8ArrayInput(
  { value, onChange }: { value: string; onChange: (v: string) => void },
) {
  // Value is base64 string
  const format = (v: string) => {
    try {
      return Uint8Array.from(atob(v), (c) => c.charCodeAt(0)).join(", ");
    } catch {
      return "";
    }
  };

  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  // Sync from parent only if not focused
  useEffect(() => {
    if (!focused.current) {
      setText(format(value));
    }
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const bytes = newText.split(/[,\s]+/).map((x) => parseInt(x.trim()))
        .filter((x) => !isNaN(x));
      const u8 = new Uint8Array(bytes);
      const bin = String.fromCharCode(...u8);
      onChange(btoa(bin));
    } catch {
      // ignore parse error, just keep text
    }
  };

  return (
    <textarea
      class="textarea textarea-bordered textarea-sm w-full max-w-lg rounded font-mono"
      value={text}
      onInput={(e) => handleChange((e.target as HTMLTextAreaElement).value)}
      onFocus={() => focused.current = true}
      onBlur={() => {
        focused.current = false;
        // On blur, force re-format to canonical
        setText(format(value));
      }}
    />
  );
}
