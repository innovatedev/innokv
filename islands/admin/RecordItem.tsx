import { ApiKvEntry, ApiKvKeyPart } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { RichValue, ValueCodec } from "@/lib/ValueCodec.ts";
import { ValueDisplay } from "./ValueDisplay.tsx";
import { ExpandIcon } from "@/components/icons/ExpandIcon.tsx";

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
    isOpen,
    onToggle,
    onEdit,
    isReadOnly,
  }: RecordItemProps,
) {
  const rich = record.value;

  return (
    <div
      class={`flex flex-col border border-base-300 rounded-lg overflow-hidden mb-2 transition-shadow hover:shadow-md ${
        selected ? "ring-2 ring-primary ring-inset" : ""
      }`}
    >
      <div
        class={`flex items-center justify-between p-3 cursor-pointer select-none bg-base-100`}
        onClick={() => onToggle(!isOpen)}
      >
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="shrink-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              class="checkbox checkbox-xs checkbox-primary"
              checked={selected}
              onChange={() => onToggleSelection(record.key)}
            />
          </div>

          <div
            class={`shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <ExpandIcon class="w-4 h-4 opacity-50" />
          </div>

          <div class="flex flex-wrap gap-1 min-w-0">
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
          </div>

          {!isOpen && (
            <div class="flex items-center gap-2 min-w-0 shrink ml-2">
              <span class="text-xs text-base-content/60 font-mono truncate hidden sm:inline-block">
                ⇒
              </span>
              <span class="text-xs text-base-content/40 font-mono truncate hidden sm:inline-block">
                <ValueDisplay value={rich?.value} />
              </span>
            </div>
          )}
        </div>

        <div class="flex items-center gap-2 shrink-0 ml-2">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            {isReadOnly ? "View" : "Edit"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div class="p-3 bg-base-200/50 border-t border-base-300">
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Key JSON</span>
                </label>
                <pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto font-mono">
                  {JSON.stringify(record.key, null, 2)}
                </pre>
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-bold">Value JSON</span>
                </label>
                <pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto font-mono">
                  {JSON.stringify(ValueCodec.decode(rich), null, 2)}
                </pre>
              </div>
            </div>

            <div class="flex justify-between items-center text-[10px] opacity-50 font-mono">
              <span>Versionstamp: {record.versionstamp}</span>
              <button
                type="button"
                class="hover:underline"
                onClick={() => {
                  const val = ValueCodec.decode(rich);
                  navigator.clipboard.writeText(JSON.stringify(val, null, 2));
                }}
              >
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
