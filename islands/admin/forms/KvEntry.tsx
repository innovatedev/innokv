import { useEffect, useState } from "preact/hooks";
import { ApiKvEntry, ApiKvKey } from "@/lib/types.ts";
import RichValueEditor from "./RichValueEditor.tsx";
import { RichValue, ValueCodec } from "@/lib/ValueCodec.ts";
import { KeyDisplay } from "../KeyDisplay.tsx";
export default function KvEntryForm({
  onSubmit,
  onCancel,
  onDelete,
  entry,
  path,
  isLoading,
  error,
  success,
}: {
  onSubmit?: (data: any, form: HTMLFormElement) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  entry?: ApiKvEntry | null;
  path?: ApiKvKey | null;
  isLoading?: boolean;
  error?: string;
  success?: string;
}) {
  const [keyParts, setKeyParts] = useState<{ type: string; value: string }[]>(
    [],
  );
  // Helper to ensure value is RichValue
  const toRichValue = (val: unknown): RichValue => {
    if (val && typeof val === "object" && "type" in val && "value" in val) {
      // Naive check if it's already encoded
      return val as RichValue;
    }
    return ValueCodec.encode(val);
  };

  // Initialize rich value from entry or default
  const [richValue, setRichValue] = useState<RichValue>(
    toRichValue(entry?.value),
  );

  const [activeTab, setActiveTab] = useState<"editor" | "json">("editor");
  const [isEditingKey, setIsEditingKey] = useState(!entry); // Default to editing if new entry
  const [jsonString, setJsonString] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditingKey(!entry);
  }, [entry]);

  useEffect(() => {
    let initialParts: { type: string; value: string }[] = [];
    if (entry && entry.key) {
      initialParts = entry.key;
    } else if (path) {
      initialParts = [...path, { type: "string", value: "" }];
    }

    if (initialParts.length > 0) {
      setKeyParts(initialParts.map((p) => {
        const type = p.type.toLowerCase();
        let value = p.value;
        if (type === "uint8array") {
          try {
            const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
            value = Array.from(bytes).join(", ");
          } catch { /* ignore */ }
        }
        return { type, value };
      }));
    } else {
      setKeyParts([]);
    }

    // Update value when entry changes
    if (entry) {
      setRichValue(toRichValue(entry.value));
    } else {
      setRichValue({ type: "object", value: {} });
    }
  }, [entry, path]);

  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;

      // Construct Key
      const key = keyParts.map((part) => {
        if (part.type === "number") return parseFloat(part.value);
        if (part.type === "boolean") return part.value === "true";
        if (part.type === "bigint") return BigInt(part.value);
        if (part.type === "uint8array") {
          let val = part.value.trim();
          if (val.startsWith("[") && val.endsWith("]")) {
            val = val.slice(1, -1);
          }
          const bytes = val.split(/[,\s]+/).map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
          return new Uint8Array(bytes);
        }
        return part.value;
      });

      const data = {
        key,
        value: richValue, // Send the RichValue object directly
      };

      onSubmit(data, form);
    }
  };

  // ... (doCancel, doDelete, addPart, removePart, updatePart same as before)
  const doCancel = (e: Event) => {
    e.preventDefault();
    if (onCancel) {
      onCancel();
    }
  };

  const doDelete = (e: Event) => {
    e.preventDefault();
    if (entry && entry.key) {
      if (confirm(`Are you sure you want to delete this entry?`)) {
        if (onDelete) {
          onDelete();
        }
      }
    }
  };

  const addPart = () => {
    setKeyParts([...keyParts, { type: "string", value: "" }]);
  };

  const removePart = (index: number) => {
    setKeyParts(keyParts.filter((_, i) => i !== index));
  };

  const updatePart = (index: number, field: "type" | "value", val: string) => {
    const newParts = [...keyParts];
    newParts[index] = { ...newParts[index], [field]: val };
    if (field === "type") {
      if (val === "boolean") newParts[index].value = "true";
    }
    setKeyParts(newParts);
  };

  return (
    <form class="form-control w-full flex flex-col" onSubmit={doSubmit}>
      {error && (
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div class="alert alert-success">
          <span>{success}</span>
        </div>
      )}

      <div class="flex flex-col gap-2">
        <label class="label font-bold flex justify-between">
          <span>Key</span>
          {entry && (
            <span class="text-xs font-mono opacity-50">
              {entry.versionstamp ? `v:${entry.versionstamp}` : "New Entry"}
            </span>
          )}
        </label>

        {/* Key Display / Editor */}
        {!isEditingKey && entry
          ? (
            <div class="flex items-center gap-2 p-2 border border-base-200 rounded-md bg-base-100">
              <div class="flex-1 flex flex-wrap gap-1">
                {entry.key.map((p, i) => (
                  <>
                    {i > 0 && (
                      <span class="text-base-content/30 select-none font-mono">
                        /
                      </span>
                    )}
                    <KeyDisplay key={i} type={p.type} value={p.value} />
                  </>
                ))}
              </div>
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                onClick={() => setIsEditingKey(true)}
              >
                Edit Key
              </button>
            </div>
          )
          : (
            <div class="flex flex-col gap-2 p-2 border border-base-200 rounded-md bg-base-100">
              {keyParts.map((part, i) => (
                <div class="flex gap-2 items-center" key={i}>
                  <select
                    class="select select-bordered select-sm w-24"
                    value={part.type}
                    onChange={(e) =>
                      updatePart(
                        i,
                        "type",
                        (e.target as HTMLSelectElement).value,
                      )}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="bigint">BigInt</option>
                    <option value="boolean">Boolean</option>
                    <option value="uint8array">Uint8Array</option>
                  </select>

                  {part.type === "boolean"
                    ? (
                      <select
                        class="select select-bordered select-sm flex-1 max-w-xs"
                        value={part.value}
                        onChange={(e) =>
                          updatePart(
                            i,
                            "value",
                            (e.target as HTMLSelectElement).value,
                          )}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    )
                    : (
                      <input
                        type={part.type === "number" ? "number" : "text"}
                        class={`input input-bordered input-sm flex-1 ${
                          part.type === "uint8array" || part.type === "string"
                            ? "max-w-lg"
                            : "max-w-xs"
                        }`}
                        value={part.value}
                        onChange={(e) =>
                          updatePart(
                            i,
                            "value",
                            (e.target as HTMLInputElement).value,
                          )}
                        placeholder={part.type === "uint8array"
                          ? "e.g. 1, 2, 255"
                          : "Key part value"}
                      />
                    )}

                  <button
                    type="button"
                    class="btn btn-square btn-sm btn-ghost"
                    onClick={() =>
                      removePart(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div class="flex gap-2 mt-2 justify-between items-center">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost gap-2"
                  onClick={addPart}
                >
                  + Add Key Part
                </button>
                {entry && (
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost text-error"
                    onClick={() => setIsEditingKey(false)}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          )}
      </div>

      <div class="mt-4 tabs tabs-boxed tabs-sm bg-base-200/50 p-1">
        <a
          class={`tab ${activeTab === "editor" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("editor")}
        >
          Editor
        </a>
        <a
          class={`tab ${activeTab === "json" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("json")}
        >
          Structure
        </a>
      </div>

      <div class="form-control">
        {activeTab === "editor"
          ? (
            <RichValueEditor
              value={richValue}
              onChange={setRichValue}
              label={""}
            />
          )
          : (
            <div class="flex flex-col gap-2">
              <textarea
                class="textarea textarea-bordered border-t-0 rounded-t-none rounded-b-lg font-mono text-xs leading-relaxed h-64 w-full"
                value={jsonError
                  ? jsonString
                  : JSON.stringify(richValue, null, 2)}
                onInput={(e) => {
                  const val = (e.target as HTMLTextAreaElement).value;
                  setJsonString(val);
                  try {
                    const parsed = JSON.parse(val);
                    if (
                      parsed && typeof parsed === "object" &&
                      "type" in parsed && "value" in parsed
                    ) {
                      setRichValue(parsed as RichValue);
                      setJsonError(null);
                    } else {
                      setJsonError(
                        "Invalid RichValue structure (missing type or value)",
                      );
                    }
                  } catch (err) {
                    setJsonError((err as Error).message);
                  }
                }}
              />
              {jsonError && (
                <div class="text-error text-xs font-bold">
                  Error: {jsonError}
                </div>
              )}
            </div>
          )}
      </div>

      <div class="flex justify-between gap-4 mt-4">
        <div>
          {entry && onDelete && (
            <button
              class="btn btn-error btn-outline btn-sm"
              type="button"
              onClick={doDelete}
              disabled={isLoading}
            >
              Delete
            </button>
          )}
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            onClick={doCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            class="btn btn-sm bg-brand hover:bg-brand/80 text-black border-none"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : (entry ? "Save Changes" : "Create")}
          </button>
        </div>
      </div>
    </form>
  );
}
