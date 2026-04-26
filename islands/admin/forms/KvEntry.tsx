import { useEffect, useMemo, useState } from "preact/hooks";
import { ApiKvEntry, ApiKvKey, ApiKvKeyPart } from "@/lib/types.ts";
import RichValueEditor from "./RichValueEditor.tsx";
import { RichValue, ValueCodec } from "@/lib/ValueCodec.ts";
import { KeyDisplay } from "../KeyDisplay.tsx";
import JsonEditor from "./JsonEditor.tsx";

interface KvEntryFormProps {
  onSubmit?: (
    data: { key: Deno.KvKeyPart[]; value: RichValue },
    form: HTMLFormElement,
  ) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  entry?: ApiKvEntry | null;
  path?: ApiKvKey | null;
  isLoading?: boolean;
  error?: string;
  success?: string;
  isReadOnly?: boolean;
}

export default function KvEntryForm({
  onSubmit,
  onCancel,
  onDelete,
  entry,
  path,
  isLoading,
  error,
  success,
  isReadOnly = false,
}: KvEntryFormProps) {
  const [keyParts, setKeyParts] = useState<{ type: string; value: string }[]>(
    [],
  );

  const toRichValue = (val: unknown): RichValue => {
    if (val && typeof val === "object" && "type" in val && "value" in val) {
      return val as RichValue;
    }
    return ValueCodec.encode(val);
  };

  const [richValue, setRichValue] = useState<RichValue>(
    toRichValue(entry?.value),
  );
  const [keyTab, setKeyTab] = useState<"editor" | "json">("editor");
  const [valueTab, setValueTab] = useState<"editor" | "json">("editor");
  const [isEditingKey, setIsEditingKey] = useState(!entry);
  const [keyJsonError, setKeyJsonError] = useState<string | null>(null);
  const [valueJsonError, setValueJsonError] = useState<string | null>(null);

  const getNormalizedKey = () =>
    keyParts.map((p) => {
      if (p.type === "number") return { ...p, value: parseFloat(p.value) };
      if (p.type === "boolean") return { ...p, value: p.value === "true" };
      if (p.type === "Uint8Array") {
        const bytes = p.value.split(/[,\s]+/).map((n) => parseInt(n.trim()))
          .filter((n) => !isNaN(n));
        return { ...p, type: "Uint8Array", value: bytes };
      }
      return p;
    }) as ApiKvKeyPart[];

  useEffect(() => {
    setIsEditingKey(!entry);
  }, [entry]);

  useEffect(() => {
    let initialParts: ApiKvKeyPart[] = [];
    if (entry && entry.key) {
      initialParts = entry.key;
    } else if (path) {
      initialParts = [...path, { type: "string", value: "" }];
    }

    if (initialParts.length > 0) {
      setKeyParts(initialParts.map((p) => {
        const type = p.type;
        let value = p.value;
        if (type.toLowerCase() === "uint8array") {
          if (Array.isArray(value)) value = value.join(", ");
          else value = "";
        }
        return { type, value: String(value) };
      }));
    } else {
      setKeyParts([]);
    }

    if (entry) setRichValue(toRichValue(entry.value));
    else setRichValue({ type: "object", value: {} });
  }, [entry, path]);

  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const key = keyParts.map((part) => {
        if (part.type === "number") return parseFloat(part.value);
        if (part.type === "boolean") return part.value === "true";
        if (part.type === "bigint") return BigInt(part.value);
        if (part.type.toLowerCase() === "uint8array") {
          let val = part.value.trim();
          if (val.startsWith("[") && val.endsWith("]")) val = val.slice(1, -1);
          const bytes = val.split(/[,\s]+/).map((n: string) =>
            parseInt(n.trim())
          ).filter((n: number) => !isNaN(n));
          return new Uint8Array(bytes);
        }
        return part.value;
      });

      onSubmit({ key, value: richValue }, form);
    }
  };

  const doCancel = (e: Event) => {
    e.preventDefault();
    if (onCancel) onCancel();
  };

  const doDelete = (e: Event) => {
    e.preventDefault();
    if (entry && entry.key && confirm(`Are you sure?`) && onDelete) onDelete();
  };

  const addPart = () =>
    setKeyParts([...keyParts, { type: "string", value: "" }]);
  const removePart = (index: number) =>
    setKeyParts(keyParts.filter((_, i) => i !== index));
  const updatePart = (index: number, field: "type" | "value", val: string) => {
    const newParts = [...keyParts];
    newParts[index] = { ...newParts[index], [field]: val };
    if (field === "type" && val === "boolean") newParts[index].value = "true";
    setKeyParts(newParts);
  };

  const resetKey = () => {
    let initialParts: ApiKvKeyPart[] = [];
    if (entry && entry.key) {
      initialParts = entry.key;
    } else if (path) {
      initialParts = [...path, { type: "string", value: "" }];
    }

    setKeyParts(initialParts.map((p) => {
      const type = p.type;
      let value = p.value;
      if (type.toLowerCase() === "uint8array") {
        if (Array.isArray(value)) value = value.join(", ");
        else value = "";
      }
      return { type, value: String(value) };
    }));
    setKeyJsonError(null);
  };

  const resetValue = () => {
    if (entry) setRichValue(toRichValue(entry.value));
    else setRichValue({ type: "object", value: {} });
    setValueJsonError(null);
  };

  const initialKey = useMemo(() => {
    let parts: ApiKvKeyPart[] = [];
    if (entry && entry.key) parts = entry.key;
    else if (path) parts = [...path, { type: "string", value: "" }];
    return JSON.stringify(parts.map((p) => ({
      type: p.type,
      value: p.type === "Uint8Array" && Array.isArray(p.value)
        ? p.value.join(", ")
        : String(p.value),
    })));
  }, [entry, path]);

  const initialValue = useMemo(() => {
    return JSON.stringify(
      entry ? toRichValue(entry.value) : { type: "object", value: {} },
    );
  }, [entry]);

  const isKeyDirty = () => {
    return !!keyJsonError || JSON.stringify(keyParts) !== initialKey;
  };

  const isValueDirty = () => {
    return !!valueJsonError || JSON.stringify(richValue) !== initialValue;
  };

  return (
    <form class="form-control w-full flex flex-col" onSubmit={doSubmit}>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div class="alert alert-success mb-4">
          <span>{success}</span>
        </div>
      )}

      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <label class="label font-bold">
            <span>Key</span>
          </label>
          <div class="flex items-center gap-2">
            {!isReadOnly && isKeyDirty() && (
              <button
                type="button"
                class="btn btn-xs btn-ghost text-xs opacity-50 hover:opacity-100 text-info"
                onClick={resetKey}
              >
                Reset
              </button>
            )}
            <div class="tabs tabs-boxed tabs-xs bg-base-200/50 p-1">
              <button
                type="button"
                class={`tab ${keyTab === "editor" ? "tab-active" : ""}`}
                onClick={() => setKeyTab("editor")}
              >
                Editor
              </button>
              <button
                type="button"
                class={`tab ${keyTab === "json" ? "tab-active" : ""}`}
                onClick={() => setKeyTab("json")}
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {keyTab === "editor"
          ? (
            !isEditingKey && entry
              ? (
                <div class="flex items-center gap-2 p-2 border border-base-200 rounded-md bg-base-100">
                  <div class="flex-1 flex flex-wrap gap-1">
                    {entry.key.map((p, i) => (
                      <span key={i}>
                        <KeyDisplay type={p.type} value={p.value} />
                        {i < entry.key.length - 1 && " / "}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost"
                    disabled={isReadOnly}
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
                        class="select select-bordered select-xs w-24"
                        value={part.type}
                        disabled={isReadOnly}
                        onChange={(e) =>
                          updatePart(
                            i,
                            "type",
                            (e.target as HTMLSelectElement).value,
                          )}
                      >
                        {["string", "number", "bigint", "boolean", "Uint8Array"]
                          .map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {part.type === "boolean"
                        ? (
                          <div class="flex-1 max-w-xs flex items-center px-2">
                            <input
                              type="checkbox"
                              class="toggle toggle-xs toggle-primary"
                              checked={part.value === "true"}
                              disabled={isReadOnly}
                              onChange={(e) =>
                                updatePart(
                                  i,
                                  "value",
                                  (e.target as HTMLInputElement).checked
                                    ? "true"
                                    : "false",
                                )}
                            />
                            <span class="ml-2 text-xs opacity-50">
                              {part.value}
                            </span>
                          </div>
                        )
                        : (
                          <input
                            type={part.type === "number" ? "number" : "text"}
                            class="input input-bordered input-xs flex-1"
                            value={part.value}
                            readOnly={isReadOnly}
                            onInput={(e) =>
                              updatePart(
                                i,
                                "value",
                                (e.target as HTMLInputElement).value,
                              )}
                          />
                        )}
                      {!isReadOnly && (
                        <button
                          type="button"
                          class="btn btn-square btn-sm btn-ghost"
                          onClick={() => removePart(i)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <div class="flex gap-2 mt-2 justify-between items-center">
                      <button
                        type="button"
                        class="btn btn-xs btn-outline"
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
                  )}
                </div>
              )
          )
          : (
            <JsonEditor
              value={getNormalizedKey()}
              height="h-32"
              isReadOnly={isReadOnly}
              onValidationError={setKeyJsonError}
              validate={(parsed) => {
                if (!Array.isArray(parsed)) return "Key must be an array";
                const allowed = [
                  "string",
                  "number",
                  "boolean",
                  "bigint",
                  "Uint8Array",
                ];
                const invalid = parsed.find((p) => !allowed.includes(p.type));
                return invalid ? `Invalid type: ${invalid.type}` : null;
              }}
              onChange={(parsed) => {
                setKeyParts(parsed.map((p) => ({
                  type: p.type,
                  value: p.type === "Uint8Array" && Array.isArray(p.value)
                    ? p.value.join(", ")
                    : String(p.value),
                })));
              }}
            />
          )}
      </div>

      <div class="mt-6 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <label class="label font-bold">
            <span>Value</span>
          </label>
          <div class="flex items-center gap-2">
            {!isReadOnly && isValueDirty() && (
              <button
                type="button"
                class="btn btn-xs btn-ghost text-xs opacity-50 hover:opacity-100 text-info"
                onClick={resetValue}
              >
                Reset
              </button>
            )}
            <div class="tabs tabs-boxed tabs-xs bg-base-200/50 p-1">
              <button
                type="button"
                class={`tab ${valueTab === "editor" ? "tab-active" : ""}`}
                onClick={() => setValueTab("editor")}
              >
                Editor
              </button>
              <button
                type="button"
                class={`tab ${valueTab === "json" ? "tab-active" : ""}`}
                onClick={() => setValueTab("json")}
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {valueTab === "editor"
          ? (
            <RichValueEditor
              value={richValue}
              onChange={setRichValue}
              label=""
              isReadOnly={isReadOnly}
            />
          )
          : (
            <JsonEditor
              value={richValue}
              height="h-64"
              onValidationError={setValueJsonError}
              validate={(parsed) =>
                (!parsed || typeof parsed !== "object" || !("type" in parsed))
                  ? "Invalid RichValue"
                  : null}
              onChange={setRichValue}
              isReadOnly={isReadOnly}
            />
          )}
      </div>

      <div class="flex justify-between gap-4 mt-8">
        <div>
          {!isReadOnly && entry && onDelete && (
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
            {isReadOnly ? "Close" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button
              class="btn btn-sm bg-brand hover:bg-brand/80 text-black border-none"
              type="submit"
              disabled={isLoading || !!keyJsonError || !!valueJsonError}
            >
              {isLoading ? "Loading..." : (entry ? "Save Changes" : "Create")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
