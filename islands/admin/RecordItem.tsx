import { ApiKvEntry, ApiKvKeyPart } from "@/lib/types.ts";
import { KeyDisplay } from "./KeyDisplay.tsx";
import { RichValue, ValueCodec } from "@/lib/ValueCodec.ts";
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

  return (
    <div
      class={`flex flex-col border border-base-300 rounded-lg overflow-hidden mb-2 transition-shadow hover:shadow-md ${
        selected ? "ring-2 ring-primary ring-inset" : ""
      }`}
    >
      <div
        class={`flex items-start justify-between p-3 select-none bg-base-100`}
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

            <div class="flex flex-wrap gap-1 min-w-0 flex-1">
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
          </div>

          <div class="mt-1.5 pl-[28px] min-w-0">
            <div class="text-xs text-base-content/40 font-mono">
              <ValueDisplay value={rich?.value} />
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
                const val = ValueCodec.decode(rich);
                navigator.clipboard.writeText(JSON.stringify(val, null, 2));
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
