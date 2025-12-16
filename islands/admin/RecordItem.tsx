import { ApiKvEntry } from "@/lib/types.ts";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { ValueCodec } from "@/lib/ValueCodec.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { MinusIcon, PlusIcon } from "@/components/icons/PlusMinusIcons.tsx";

interface RecordItemProps {
  record: ApiKvEntry;
  isOpen?: boolean;
  onEdit: (record: ApiKvEntry) => void;
  isSelected?: boolean;
  onToggleSelection?: (selected: boolean) => void;
  isReadOnly?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export function RecordItem(
  {
    record,
    isOpen = false,
    onEdit,
    isSelected = false,
    onToggleSelection,
    isReadOnly,
    onToggle,
  }: RecordItemProps,
) {
  return (
    <details
      open={isOpen}
      onToggle={(e: Event) => {
        const target = e.target as HTMLDetailsElement;
        onToggle?.(target.open);
      }}
      class={`collapse border rounded-sm border-white/10 ${
        isSelected
          ? "bg-primary/20 border-primary/20 hover:bg-primary/30"
          : "odd:bg-black/20"
      } hover:bg-info/10`}
    >
      <summary class="collapse-title font-semibold group relative text-base-content pr-4">
        <div class="flex gap-2 items-center w-full">
          <input
            type="checkbox"
            class="checkbox checkbox-xs shrink-0"
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection?.((e.target as HTMLInputElement).checked);
            }}
          />
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <span class="text-lg font-bold truncate text-base-content flex items-center gap-2 shrink-0">
              <KeyDisplay
                type={record.key[record.key.length - 1].type}
                value={record.key[record.key.length - 1].value}
              />
              {" "}
            </span>
            <span class="text-xs text-base-content/60 font-mono truncate hidden sm:inline-block">
              ⇒
            </span>
            {!([
                "map",
                "set",
                "array",
                "object",
                "uint8array",
              ]
                .includes(record.value?.type))
              ? (
                <span class="text-xs text-base-content/40 font-mono truncate hidden sm:inline-block">
                  <ValueDisplay value={record.value?.value} />
                </span>
              )
              : (
                <span class="badge badge-xs badge-outline text-base-content/40">
                  {record.value?.type} {(() => {
                    const val = (record.value as any)?.value;
                    if (!val) return "";
                    if ((record.value as any)?.type === "uint8array") {
                      try {
                        return `(${atob(val).length})`;
                      } catch {
                        return "";
                      }
                    }
                    if (Array.isArray(val)) return `(${val.length})`; // Map, Set, Array often serialized as array
                    if (typeof val === "object") {return `(${
                        Object.keys(val).length
                      })`;}
                    return "";
                  })()}
                </span>
              )}
          </div>

          <div class="flex items-center gap-2 min-w-0 shrink text-right ml-1 transition-opacity">
            <span class="text-xs text-base-content/40 font-mono truncate hidden sm:inline-block">
              v:{record.versionstamp}
            </span>
            {isReadOnly !== true && (
              <button
                class="btn btn-xs bg-brand hover:bg-brand/80 text-black border-none shadow-sm hover:shadow-md transition-all shrink-0 opacity-0 group-hover:opacity-100"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onEdit(record);
                }}
              >
                Edit
              </button>
            )}

            <div class="text-base-content/50">
              {isOpen
                ? <MinusIcon class="w-4 h-4" />
                : <PlusIcon class="w-4 h-4" />}
            </div>
          </div>
        </div>
      </summary>
      <div class="collapse-content text-sm bg-base-200/50 p-0! flex flex-col">
        <div
          class="p-4 border-t border-base-300 bg-base-100 cursor-text"
          onDblClick={(e) => {
            if ((e.target as HTMLElement).closest("span")) return;
            e.preventDefault();
            if (!isReadOnly) onEdit(record);
          }}
        >
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
        </div>
      </div>
    </details>
  );
}
