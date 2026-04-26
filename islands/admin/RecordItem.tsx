import { ApiKvEntry, ApiKvKeyPart } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { RichValue } from "@/lib/ValueCodec.ts";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { KeyCodec } from "@/lib/KeyCodec.ts";

interface RecordItemProps {
  record: ApiKvEntry<RichValue>;
  selected: boolean;
  onToggleSelection: (key: ApiKvKeyPart[]) => void;
  prettyPrintDates: boolean;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  onEdit: () => void;
  onIncrement?: (amount: bigint) => void;
  isReadOnly: boolean;
}

export default function RecordItem(
  {
    record,
    selected,
    onToggleSelection,
    prettyPrintDates,
    onEdit,
    onIncrement,
    isReadOnly,
  }: Omit<RecordItemProps, "isOpen" | "onToggle">,
) {
  const rich = record.value;
  const hasInValueExpiration = rich?.type === "object" &&
    rich.value &&
    (rich.value as Record<string, RichValue>)["expiresAt"];

  return (
    <div
      class={`flex flex-col border border-base-300 rounded-lg overflow-hidden mb-2 transition-shadow hover:shadow-md ${
        selected ? "ring-2 ring-primary ring-inset" : ""
      }`}
    >
      <div
        class={`flex items-start justify-between px-3 py-1.5 select-none bg-base-100`}
      >
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(record.key);
              }}
            >
              <input
                type="checkbox"
                class="checkbox checkbox-xs checkbox-primary"
                checked={selected}
                readOnly
              />
            </div>

            <div class="flex flex-wrap gap-1 min-w-0 flex-1 items-center">
              {record.key.map((p, i) => (
                <div key={i} class="flex items-center gap-1">
                  {i > 0 && (
                    <span class="text-base-content/30 select-none font-mono">
                      /
                    </span>
                  )}
                  <KeyDisplay
                    type={p.type}
                    value={p.value}
                    prettyPrint={prettyPrintDates}
                  />
                </div>
              ))}
              {hasInValueExpiration && (
                <div
                  class="tooltip tooltip-right"
                  data-tip="This record tracks its own expiration (expiresAt)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-3.5 h-3.5 text-warning ml-1"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div class="mt-1.5 pl-[28px] min-w-0 flex items-center gap-2">
            <div class="text-xs text-base-content/40 font-mono">
              <ValueDisplay value={rich?.value} />
            </div>
            {rich?.type === "KvU64" && !isReadOnly && onIncrement && (
              <button
                type="button"
                class="btn btn-brand btn-xs h-5 min-h-0 text-[10px] px-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement(1n);
                }}
                title="Atomic Increment (+1)"
              >
                +1
              </button>
            )}
          </div>
        </div>

        <div class="flex flex-col items-end gap-2 shrink-0 ml-4">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-ghost btn-xs text-[10px] opacity-50 hover:opacity-100"
              title="Copy Key JSON"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(record.key));
              }}
            >
              Key
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-[10px] opacity-50 hover:opacity-100"
              title="Copy Path"
              onClick={() => {
                navigator.clipboard.writeText(KeyCodec.encode(record.key));
              }}
            >
              Path
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs text-[10px] opacity-50 hover:opacity-100"
              title="Copy Value JSON"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(rich, null, 2));
              }}
            >
              JSON
            </button>
            <div class="w-px h-3 bg-base-300 mx-1"></div>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={onEdit}
            >
              {isReadOnly ? "View" : "Edit"}
            </button>
          </div>
          <div class="text-[10px] opacity-30 font-mono truncate max-w-[150px]">
            {record.versionstamp}
          </div>
        </div>
      </div>
    </div>
  );
}
