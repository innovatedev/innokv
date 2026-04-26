import { KeyCodec } from "@/codec/mod.ts";
import { useSignal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import Dialog from "../Dialog.tsx";
import { ApiKvKeyPart } from "@/lib/types.ts";

import { KeyDisplay } from "../KeyDisplay.tsx";

import { Database } from "@/kv/models.ts";
import { RefObject } from "preact";

interface MoveRecordsProps {
  dialogRef: RefObject<HTMLDialogElement>;
  onMove: (
    newPath: string,
    recursive: boolean,
    targetId?: string,
    keys?: ApiKvKeyPart[][],
  ) => Promise<void>;
  currentPath: ApiKvKeyPart[];
  keys?: ApiKvKeyPart[][];
  databases: Database[];
  activeDatabase: Database | null;
  mode: "move" | "copy";
}

export default function MoveRecords(
  { dialogRef, onMove, currentPath, keys, databases, activeDatabase, mode }:
    MoveRecordsProps,
) {
  const [keyParts, setKeyParts] = useState<{ type: string; value: string }[]>(
    [],
  );
  const recursive = useSignal(true);
  const loading = useSignal(false);
  const error = useSignal<string | null>(null);
  const targetDatabaseId = useSignal(activeDatabase?.id || "");

  useEffect(() => {
    if (activeDatabase?.id) {
      targetDatabaseId.value = activeDatabase.id;
    }
  }, [activeDatabase]);

  useEffect(() => {
    if (currentPath) {
      setKeyParts(currentPath.map((p) => {
        const type = p.type;
        let value = p.value;
        if (type.toLowerCase() === "uint8array") {
          if (Array.isArray(value)) {
            value = value.join(", ");
          } else {
            value = "";
          }
        }
        return { type, value: String(value) };
      }));
    }
  }, [currentPath]);

  const addPart = () => {
    setKeyParts([...keyParts, { type: "string", value: "" }]);
  };

  const removePart = (index: number) => {
    setKeyParts(keyParts.filter((_, i) => i !== index));
  };

  const movePart = (index: number, direction: -1 | 1) => {
    const newParts = [...keyParts];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newParts.length) return;
    const temp = newParts[index];
    newParts[index] = newParts[targetIndex];
    newParts[targetIndex] = temp;
    setKeyParts(newParts);
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
      const processedParts: ApiKvKeyPart[] = keyParts.map((part) => {
        if (part.type.toLowerCase() === "uint8array") {
          let val = part.value.trim();
          if (val.startsWith("[") && val.endsWith("]")) {
            val = val.slice(1, -1);
          }
          const bytes = val.split(/[,\s]+/).map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
          return {
            type: "Uint8Array",
            value: bytes,
          };
        }
        return {
          type: part.type,
          value: part.value,
        };
      });

      const encodedPath = KeyCodec.encode(processedParts);
      await onMove(encodedPath, recursive.value, targetDatabaseId.value, keys);
      dialogRef.current?.close();
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  };

  const isDuplicate = mode === "copy";
  const actionLabel = isDuplicate ? "Duplicate" : "Move";

  return (
    <Dialog
      ref={dialogRef}
      title={`${actionLabel} ${keys ? "Records" : "Path"}`}
    >
      <form onSubmit={handleSubmit} class="space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">
              {keys ? "Selected Records" : "Source Path"}
            </span>
          </label>
          <div class="flex flex-wrap gap-1 p-2 border border-base-200 rounded-md bg-base-200/50">
            {keys
              ? (
                <span class="text-xs font-bold text-primary">
                  {keys.length} records selected for{" "}
                  {activeDatabase?.name || activeDatabase?.slug ||
                    activeDatabase?.id}
                </span>
              )
              : currentPath.length > 0
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
            <span class="label-text font-bold">Target Database</span>
          </label>
          <select
            class="select select-bordered select-xs w-full"
            value={targetDatabaseId.value}
            onChange={(e) =>
              targetDatabaseId.value = (e.target as HTMLSelectElement).value}
          >
            {databases
              .filter((db) => db.mode !== "r")
              .map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name || db.slug} ({db.type})
                </option>
              ))}
          </select>
          <label class="label">
            <span class="label-text-alt opacity-50">
              {isDuplicate
                ? "Duplicate records to another database."
                : "Pick the destination database for the records."}
            </span>
          </label>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-bold">Destination Path</span>
          </label>
          <div class="flex flex-col gap-2 p-2 border border-base-200 rounded-md bg-base-100 shadow-inner">
            {keyParts.map((part, i) => (
              <div class="flex gap-2 items-center" key={i}>
                <select
                  class="select select-bordered select-xs w-24"
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
                  <option value="Uint8Array">Uint8Array</option>
                </select>

                {part.type === "boolean"
                  ? (
                    <select
                      class="select select-bordered select-xs flex-1 max-w-xs"
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
                      class={`input input-bordered input-xs flex-1 max-w-xs`}
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

                <div class="flex flex-col shrink-0">
                  <button
                    type="button"
                    class="btn btn-square btn-xs btn-ghost h-4 min-h-0"
                    disabled={i === 0}
                    onClick={() =>
                      movePart(i, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    class="btn btn-square btn-xs btn-ghost h-4 min-h-0"
                    disabled={i === keyParts.length - 1}
                    onClick={() =>
                      movePart(i, 1)}
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-square btn-xs btn-ghost shrink-0"
                  onClick={() => removePart(i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <div class="flex gap-2 mt-2 justify-between items-center">
              <div class="flex gap-1">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost gap-1 text-[10px] uppercase h-7 min-h-0"
                  onClick={() =>
                    setKeyParts([{ type: "string", value: "" }, ...keyParts])}
                >
                  + At Start
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-ghost gap-1 text-[10px] uppercase h-7 min-h-0"
                  onClick={addPart}
                >
                  + At End
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-2 p-2 bg-info/5 border border-info/20 rounded text-[10px] text-base-content/80">
          <strong class="text-info uppercase tracking-wider">Note:</strong>{" "}
          {isDuplicate ? "Duplication" : "Moves"} are performed recursively.
          {" "}
          {targetDatabaseId.value !== activeDatabase?.id
            ? (
              <span class="text-warning ml-1">
                Cross-database {isDuplicate ? "duplications" : "moves"} are{" "}
                <strong>not atomic</strong>. Records are copied to the target.
                {!isDuplicate &&
                  " and then deleted from the source."}
              </span>
            )
            : (
              <span class="ml-1">
                For large datasets, operations are performed entry-by-entry and
                are <strong class="text-base-content">not fully atomic</strong>.
              </span>
            )}
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
            disabled={loading.value || !targetDatabaseId.value}
          >
            {loading.value
              ? `${isDuplicate ? "Duplicating" : "Moving"}...`
              : `${actionLabel} Records`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
