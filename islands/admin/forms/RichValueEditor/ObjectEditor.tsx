import { useState } from "preact/hooks";
import { RichValue, RichValueType, ValueCodec } from "@/lib/ValueCodec.ts";
import RichValueEditor from "./index.tsx";

interface ObjectEditorProps {
  value: Record<string, RichValue>;
  onChange: (v: Record<string, RichValue>) => void;
  depth: number;
  isReadOnly: boolean;
}

export function ObjectEditor(
  { value, onChange, depth, isReadOnly }: ObjectEditorProps,
) {
  const entries = Object.entries(value || {});
  const [newKey, setNewKey] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyName, setEditKeyName] = useState("");
  const [lastType, setLastType] = useState<RichValueType>("string");

  const addField = (e: Event) => {
    e.preventDefault();
    if (newKey && !(newKey in (value || {}))) {
      onChange({
        ...value,
        [newKey]: {
          type: lastType,
          value: ValueCodec.getDefaultValue(lastType),
        },
      });
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
    setLastType(newVal.type);
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
                  class={`font-bold text-sm bg-base-200 px-2 py-0.5 rounded ${
                    isReadOnly
                      ? "cursor-default"
                      : "cursor-text hover:bg-base-300 transition-colors"
                  }`}
                  onClick={() => !isReadOnly && startEditing(key)}
                  title={isReadOnly ? undefined : "Click to rename"}
                >
                  {key}
                </span>
              )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => removeField(key)}
                class="btn btn-xs btn-ghost text-error"
              >
                Remove
              </button>
            )}
          </div>
          <RichValueEditor
            value={val as RichValue}
            onChange={(v: RichValue) => updateField(key, v)}
            depth={depth}
            isReadOnly={isReadOnly}
          />
        </div>
      ))}

      {!isReadOnly && (
        isAdding
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
                class="btn btn-xs btn-outline"
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
          )
      )}
    </div>
  );
}
