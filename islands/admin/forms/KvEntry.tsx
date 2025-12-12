import { useEffect, useState } from "preact/hooks";
import { ApiKvEntry, ApiKvKey } from "@/lib/types.ts";

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

  useEffect(() => {
    let initialParts: { type: string; value: string }[] = [];
    if (entry && entry.key) {
      initialParts = entry.key;
    } else if (path) {
      initialParts = [...path];
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
  }, [entry, path]);

  const doSubmit = (e: Event) => {
    if (onSubmit) {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);

      // Parse Value
      let value: any;
      try {
        value = JSON.parse(formData.get("value") as string);
      } catch (e) {
        alert("Invalid JSON value");
        return;
      }

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
        value,
      };

      onSubmit(data, form);
    }
  };

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
    // Reset value if type changes to boolean/etc? Maybe not needed for simple texts.
    if (field === "type") {
      if (val === "boolean") newParts[index].value = "true";
    }
    setKeyParts(newParts);
  };

  return (
    <form class="form-control w-full flex flex-col gap-4" onSubmit={doSubmit}>
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
        <label class="label font-bold">Key</label>
        <div class="flex flex-col gap-2">
          {keyParts.map((part, i) => (
            <div class="flex gap-2 items-center" key={i}>
              <select
                class="select select-bordered select-sm w-24"
                value={part.type}
                onChange={(e) =>
                  updatePart(i, "type", (e.target as HTMLSelectElement).value)}
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
                    class="select select-bordered select-sm flex-1"
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
                    class="input input-bordered input-sm flex-1"
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
        </div>
        <button
          type="button"
          class="btn btn-sm btn-ghost self-start gap-2"
          onClick={addPart}
        >
          + Add Key Part
        </button>
      </div>

      <label class="form-control">
        <div class="label">
          <span class="label-text font-bold">Value (JSON)</span>
        </div>
        <textarea
          rows={12}
          class="textarea textarea-bordered font-mono text-xs w-full"
          name="value"
          defaultValue={entry?.value
            ? JSON.stringify(entry.value, null, 2)
            : ""}
          required
        />
      </label>

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
            class="btn btn-primary btn-sm"
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
