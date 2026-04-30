import { KeyCodec, RichValue } from "@/codec/mod.ts";
import { ApiKvEntry, ApiKvKeyPart } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";

import { ValueDisplay } from "./ValueDisplay.tsx";

interface RecordItemProps {
  record: ApiKvEntry<RichValue>;
  selected: boolean;
  onToggleSelection: (key: ApiKvKeyPart[]) => void;
  prettyPrintDates: boolean;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  onEdit: () => void;
  isReadOnly: boolean;
}

export default function RecordItem(
  {
    record,
    selected,
    onToggleSelection,
    prettyPrintDates,
    onEdit,
    isReadOnly,
  }: Omit<RecordItemProps, "isOpen" | "onToggle">,
) {
  const rich = record.value;
  const hasInValueExpiration = rich?.type === "object" &&
    rich.value &&
    (rich.value as Record<string, RichValue>)["expiresAt"];

  return (
    <div
      class={`group flex flex-col border border-base-300 rounded-lg overflow-hidden mb-2 transition-shadow hover:shadow-md ${
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
              <ValueDisplay value={rich} />
            </div>
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
          <div class="flex items-center gap-2 text-[10px] opacity-30 font-mono">
            {record.size !== undefined && (
              <span
                class={`flex items-center gap-1 ${
                  record.size > 60 * 1024
                    ? "text-error font-bold opacity-100"
                    : ""
                }`}
              >
                {(record.size / 1024).toFixed(2)} KB
                {record.size > 60 * 1024 && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-3 h-3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                )}
              </span>
            )}
            <span class="truncate max-w-[150px]">{record.versionstamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
