import { useEffect, useMemo, useState } from "preact/hooks";
import { ApiKvEntry, ApiKvKey, ApiKvKeyPart } from "@/lib/types.ts";
import RichValueEditor from "./RichValueEditor/index.tsx";
import { RichValue, ValueCodec } from "@/lib/ValueCodec.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { KeyDisplay } from "../KeyDisplay.tsx";
import JsonEditor from "./JsonEditor.tsx";
import { NumberInput } from "./RichValueEditor/NumberInput.tsx";

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
      if (p.type === "number") {
        if (p.value === "NaN") return { ...p, value: NaN };
        if (p.value === "Infinity") return { ...p, value: Infinity };
        if (p.value === "-Infinity") return { ...p, value: -Infinity };
        return { ...p, value: parseFloat(p.value) };
      }
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

  const [expiresAt, setExpiresAt] = useState<string>(
    entry?.expiresAt
      ? new Date(entry.expiresAt).toISOString().slice(0, 16)
      : "",
  );
  const [hasExpiration, setHasExpiration] = useState(!!entry?.expiresAt);

  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const key = KeyCodec.toNative(keyParts as ApiKvKeyPart[]);

      // deno-lint-ignore no-explicit-any
      (onSubmit as any)({
        key,
        value: richValue,
        expiresAt: (hasExpiration && expiresAt)
          ? new Date(expiresAt).getTime()
          : null,
      }, form);
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
                        {[
                          { label: "String", val: "string" },
                          { label: "Number", val: "number" },
                          { label: "BigInt", val: "bigint" },
                          { label: "Boolean", val: "boolean" },
                          { label: "Uint8Array", val: "Uint8Array" },
                        ]
                          .map((t) => (
                            <option key={t.val} value={t.val}>{t.label}</option>
                          ))}
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
                        : part.type === "number"
                        ? (
                          <div class="flex-1 max-w-xs">
                            <NumberInput
                              value={part.value}
                              disabled={isReadOnly}
                              onChange={(v) =>
                                updatePart(i, "value", String(v))}
                            />
                          </div>
                        )
                        : (
                          <input
                            type="text"
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

      <div class="mt-4 flex flex-col gap-2 border-t border-base-200 pt-4">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            class="checkbox checkbox-xs checkbox-primary"
            checked={hasExpiration}
            disabled={isReadOnly}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              setHasExpiration(checked);
              if (checked && !expiresAt) {
                // Default to 24h from now if enabling for the first time
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setExpiresAt(tomorrow.toISOString().slice(0, 16));
              }
            }}
          />
          <span class="text-xs font-bold opacity-70">
            Set Record Expiration (TTL)
          </span>
        </label>

        {hasExpiration && (
          <div class="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div class="flex gap-2 items-center">
              <input
                type="datetime-local"
                class="input input-bordered input-sm flex-1"
                value={expiresAt}
                disabled={isReadOnly}
                onChange={(e) =>
                  setExpiresAt((e.target as HTMLInputElement).value)}
              />
              {expiresAt && !isReadOnly && (
                <button
                  type="button"
                  class="btn btn-square btn-sm btn-ghost text-error"
                  onClick={() => setExpiresAt("")}
                  title="Clear date"
                >
                  ✕
                </button>
              )}
            </div>
            <span class="text-[10px] opacity-40 px-1">
              Record will be automatically deleted by Deno KV at the specified
              time.
            </span>

            {(() => {
              if (richValue.type !== "object" || !hasExpiration) return null;
              const inValueExpr =
                (richValue.value as Record<string, RichValue>)["expiresAt"];
              const inValueTime = inValueExpr?.type === "date"
                ? new Date(inValueExpr.value as string).getTime()
                : null;
              const formTime = expiresAt ? new Date(expiresAt).getTime() : null;

              if (inValueTime === formTime) return null;

              return (
                <div class="alert border-warning/30 bg-warning/5 py-2 px-3 text-[10px] gap-2 mt-2 leading-tight text-warning">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    class="stroke-current shrink-0 w-4 h-4 opacity-70"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div class="flex-1 opacity-90">
                    {inValueTime === null
                      ? "Deno KV doesn't return expiration times when reading. Best practice is to track it in your value."
                      : "In-value expiration is out of sync with the record expiration."}
                  </div>
                  <button
                    type="button"
                    class="btn btn-xs btn-outline btn-warning h-6 min-h-0 px-2 font-bold"
                    onClick={() => {
                      const obj = {
                        ...(richValue.value as Record<string, RichValue>),
                      };
                      obj["expiresAt"] = {
                        type: "date",
                        value: new Date(expiresAt).toISOString(),
                      };
                      setRichValue({ ...richValue, value: obj });
                    }}
                  >
                    {inValueTime === null ? "Sync to Value" : "Update Value"}
                  </button>
                </div>
              );
            })()}
          </div>
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
