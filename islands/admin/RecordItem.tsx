import { useState } from "preact/hooks";
import { ApiKvEntry } from "@/lib/types.ts";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { ValueCodec } from "@/lib/ValueCodec.ts";

interface RecordItemProps {
  record: ApiKvEntry;
  isOpen?: boolean;
  onEdit: (record: ApiKvEntry) => void;
  isSelected?: boolean;
  onToggleSelection?: (selected: boolean) => void;
  isReadOnly?: boolean;
}

export function RecordItem(
  {
    record,
    isOpen = false,
    onEdit,
    isSelected = false,
    onToggleSelection,
    isReadOnly,
  }: RecordItemProps,
) {
  const [activeTab, setActiveTab] = useState<"value" | "json">("value");

  return (
    <details
      open={isOpen}
      class={`collapse collapse-plus join-item border-base-300 border ${
        isSelected ? "bg-base-200 border-primary/20" : "bg-base-100"
      }`}
    >
      <summary class="collapse-title font-semibold group">
        <div class="flex gap-2 items-center w-full pr-8">
          <input
            type="checkbox"
            class="checkbox checkbox-xs"
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection?.((e.target as HTMLInputElement).checked);
            }}
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-lg font-bold truncate text-base-content">
                {record.key[record.key.length - 1].value}
              </span>
              <span class="badge badge-sm badge-neutral text-xs font-mono opacity-50">
                {record.key[record.key.length - 1].type}
              </span>
            </div>
            <div class="text-xs text-base-content/60 font-mono truncate max-w-md">
              {typeof record.value === "object"
                ? JSON.stringify(record.value)
                : String(record.value)}
            </div>
          </div>

          <div class="flex items-center gap-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-xs text-base-content/40 font-mono">
              {record.versionstamp}
            </span>
            {isReadOnly !== true && (
              <button
                class="btn btn-xs bg-brand hover:bg-brand/80 text-black border-none shadow-sm hover:shadow-md transition-all"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onEdit(record);
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </summary>
      <div class="collapse-content text-sm bg-base-200/50 p-0! flex flex-col">
        <div class="tabs tabs-boxed tabs-sm bg-base-200/50 p-2 rounded-none gap-2">
          <a
            class={`tab ${activeTab === "value" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("value")}
          >
            Value
          </a>
          <a
            class={`tab ${activeTab === "json" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("json")}
          >
            JSON
          </a>
        </div>

        <div class="p-4 border-t border-base-300 bg-base-100">
          {activeTab === "value" && (
            <div class="font-mono text-xs overflow-x-auto">
              <ValueDisplay
                value={(() => {
                  try {
                    // Attempt to decode RichValue to native type for display
                    if (
                      record.value && typeof record.value === "object" &&
                      "type" in record.value
                    ) {
                      return ValueCodec.decode(record.value as any);
                    }
                    return record.value;
                  } catch {
                    return record.value;
                  }
                })()}
              />
            </div>
          )}

          {activeTab === "json" && (
            <div class="bg-base-300/50 rounded p-2 overflow-x-auto">
              <pre class="font-mono text-[10px] text-base-content/60 leading-relaxed">{JSON.stringify(record.value, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
