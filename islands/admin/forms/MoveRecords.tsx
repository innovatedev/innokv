import { KeyCodec } from "@/codec/mod.ts";
import { useSignal } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import Dialog from "../Dialog.tsx";
import KeyEditor from "./components/KeyEditor.tsx";
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
            <KeyEditor
              keyParts={keyParts}
              onChange={setKeyParts}
            />
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
