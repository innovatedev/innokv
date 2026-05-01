import { NumberInput } from "../RichValueEditor/NumberInput.tsx";

interface KeyPart {
  type: string;
  value: string;
}

interface KeyEditorProps {
  keyParts: KeyPart[];
  onChange: (parts: KeyPart[]) => void;
  isReadOnly?: boolean;
}

export default function KeyEditor({
  keyParts,
  onChange,
  isReadOnly = false,
}: KeyEditorProps) {
  const addPart = () => onChange([...keyParts, { type: "string", value: "" }]);
  const removePart = (index: number) =>
    onChange(keyParts.filter((_, i) => i !== index));

  const movePart = (index: number, direction: -1 | 1) => {
    const newParts = [...keyParts];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newParts.length) return;
    const temp = newParts[index];
    newParts[index] = newParts[targetIndex];
    newParts[targetIndex] = temp;
    onChange(newParts);
  };

  const updatePart = (index: number, field: "type" | "value", val: string) => {
    const newParts = [...keyParts];
    newParts[index] = { ...newParts[index], [field]: val };
    if (field === "type" && val === "boolean") newParts[index].value = "true";
    onChange(newParts);
  };

  return (
    <div class="flex flex-col gap-2 p-2 border border-base-200 rounded-md bg-base-100">
      {keyParts.map((part, i) => (
        <div class="flex gap-2 items-center" key={i}>
          <select
            class="select select-bordered select-xs w-24 shrink-0"
            value={part.type}
            disabled={isReadOnly}
            onChange={(e) =>
              updatePart(i, "type", (e.target as HTMLSelectElement).value)}
          >
            {[
              { label: "String", val: "string" },
              { label: "Number", val: "number" },
              { label: "BigInt", val: "bigint" },
              { label: "Boolean", val: "boolean" },
              { label: "Uint8Array", val: "Uint8Array" },
            ].map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
          </select>

          {part.type === "boolean"
            ? (
              <div class="flex-1 flex items-center px-2 min-w-0">
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-primary"
                  checked={part.value === "true"}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    updatePart(
                      i,
                      "value",
                      (e.target as HTMLInputElement).checked ? "true" : "false",
                    )}
                />
                <span class="ml-2 text-xs opacity-50 truncate">
                  {part.value}
                </span>
              </div>
            )
            : part.type === "number"
            ? (
              <div class="flex-1 min-w-0">
                <NumberInput
                  value={part.value}
                  disabled={isReadOnly}
                  onChange={(v) => updatePart(i, "value", String(v))}
                />
              </div>
            )
            : (
              <input
                type="text"
                class="input input-bordered input-xs flex-1 min-w-0"
                value={part.value}
                readOnly={isReadOnly}
                onInput={(e) =>
                  updatePart(i, "value", (e.target as HTMLInputElement).value)}
                placeholder={part.type === "Uint8Array"
                  ? "e.g. 1, 2, 255"
                  : "Key part value"}
              />
            )}

          {!isReadOnly && (
            <div class="flex items-center">
              <div class="flex flex-col mr-1">
                <button
                  type="button"
                  class="btn btn-square btn-xs btn-ghost h-4 min-h-0"
                  disabled={i === 0}
                  onClick={() => movePart(i, -1)}
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  class="btn btn-square btn-xs btn-ghost h-4 min-h-0"
                  disabled={i === keyParts.length - 1}
                  onClick={() => movePart(i, 1)}
                  title="Move Down"
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                class="btn btn-square btn-xs btn-ghost text-error"
                onClick={() => removePart(i)}
                title="Remove Key Part"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}

      {!isReadOnly && (
        <div class="flex gap-2 mt-2">
          <button
            type="button"
            class="btn btn-xs btn-outline"
            onClick={addPart}
          >
            + Add Key Part
          </button>
        </div>
      )}
    </div>
  );
}
