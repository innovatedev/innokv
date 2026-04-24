import { useSignal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import Dialog from "../Dialog.tsx";
import { ApiKvKeyPart } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { KeyDisplay } from "../KeyDisplay.tsx";

import { RefObject } from "preact";

interface MoveRecordsProps {
  dialogRef: RefObject<HTMLDialogElement>;
  onMove: (newPath: string, recursive: boolean) => Promise<void>;
  currentPath: ApiKvKeyPart[];
}

export default function MoveRecords(
  { dialogRef, onMove, currentPath }: MoveRecordsProps,
) {
  const [keyParts, setKeyParts] = useState<{ type: string; value: string }[]>(
    [],
  );
  const recursive = useSignal(true);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  useEffect(() => {
    if (currentPath) {
      setKeyParts(currentPath.map((p) => {
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
    }
  }, [currentPath]);

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

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    loading.value = true;
    error.value = null;
    try {
      // Process key parts to ensure types are correct for KeyCodec
      const processedParts = keyParts.map((part) => {
        if (part.type === "uint8array") {
          let val = part.value.trim();
          if (val.startsWith("[") && val.endsWith("]")) {
            val = val.slice(1, -1);
          }
          const bytes = val.split(/[,\s]+/).map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
          const u8 = new Uint8Array(bytes);
          // KeyCodec expects base64 for uint8array type
          return {
            type: "uint8array",
            value: btoa(String.fromCharCode(...u8)),
          };
        }
        return part;
      });

      const encodedPath = KeyCodec.encode(processedParts);
      await onMove(encodedPath, recursive.value);
      dialogRef.current?.close();
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  };

  return (
    <Dialog ref={dialogRef} title="Move / Rename Records">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">Source Path</span>
          </label>
          <div class="flex flex-wrap gap-1 p-2 border border-base-200 rounded-md bg-base-200/50">
            {currentPath.length > 0
              ? (
                currentPath.map((p, i) => (
                  <>
                    {i > 0 && (
                      <span class="text-base-content/30 select-none font-mono">
                        /
                      </span>
                    )}
                    <KeyDisplay key={i} type={p.type} value={p.value} />
                  </>
                ))
              )
              : <span class="text-xs opacity-50 italic">/ (root)</span>}
          </div>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">Destination Path</span>
          </label>
          <div class="flex flex-col gap-2 p-2 border border-base-200 rounded-md bg-base-100 shadow-inner">
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
                      onInput={(e) =>
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
                class="btn btn-sm btn-ghost gap-2 text-xs"
                onClick={addPart}
              >
                + Add Key Part
              </button>
            </div>
          </div>
        </div>

        <div class="mt-2 p-2 bg-info/5 border border-info/20 rounded text-[10px] text-base-content/80">
          <strong class="text-info uppercase tracking-wider">Note:</strong>{" "}
          Moves are performed recursively. For large datasets, operations are
          performed entry-by-entry and are{" "}
          <strong class="text-base-content">not fully atomic</strong>. If
          interrupted, some records may remain in the old path.
        </div>

        {error.value && (
          <div class="alert alert-error text-xs py-2 shadow-sm">
            <span>{error.value}</span>
          </div>
        )}

        <div class="modal-action">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            class={`btn btn-sm btn-primary ${loading.value ? "loading" : ""}`}
            disabled={loading.value}
          >
            {loading.value ? "Moving..." : "Move Records"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
