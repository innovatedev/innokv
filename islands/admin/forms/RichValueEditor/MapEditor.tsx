import { RichValue, RichValueType, ValueCodec } from "@/codec/mod.ts";
import { useState } from "preact/hooks";

import RichValueEditor from "./index.tsx";

interface MapEditorProps {
  value: [RichValue, RichValue][];
  onChange: (v: [RichValue, RichValue][]) => void;
  depth: number;
  isReadOnly: boolean;
}

export function MapEditor(
  { value, onChange, depth, isReadOnly }: MapEditorProps,
) {
  // value is array of [Key(RichValue), Value(RichValue)]
  const list = value || [];
  const [lastKeyType, setLastKeyType] = useState<RichValueType>(
    list.length > 0 ? list[list.length - 1][0].type : "string",
  );
  const [lastValueType, setLastValueType] = useState<RichValueType>(
    list.length > 0 ? list[list.length - 1][1].type : "string",
  );

  const addItem = () => {
    onChange([...list, [
      { type: lastKeyType, value: ValueCodec.getDefaultValue(lastKeyType) },
      { type: lastValueType, value: ValueCodec.getDefaultValue(lastValueType) },
    ]]);
  };

  const removeItem = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  const updateEntry = (
    idx: number,
    type: "key" | "value",
    newVal: RichValue,
  ) => {
    if (type === "key") setLastKeyType(newVal.type);
    else setLastValueType(newVal.type);

    const newList = [...list];
    // newList[idx] is [k, v]
    const pair = [...newList[idx]] as [RichValue, RichValue];
    pair[type === "key" ? 0 : 1] = newVal;
    newList[idx] = pair;
    onChange(newList);
  };

  return (
    <div class="flex flex-col gap-2">
      {list.map((val, idx) => (
        <div
          key={idx}
          class="p-2 border border-base-300 rounded bg-base-200 flex flex-col gap-2"
        >
          <div class="flex justify-between items-center text-xs opacity-70">
            <span>Entry {idx + 1}</span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                class="text-error hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <RichValueEditor
              value={val[0]}
              onChange={(v: RichValue) => updateEntry(idx, "key", v)}
              depth={depth + 1}
              label="Key"
              isReadOnly={isReadOnly}
            />
            <span class="mt-8 text-base-content/50">→</span>
            <RichValueEditor
              value={val[1]}
              onChange={(v: RichValue) => updateEntry(idx, "value", v)}
              depth={depth + 1}
              label="Value"
              isReadOnly={isReadOnly}
            />
          </div>
        </div>
      ))}
      {!isReadOnly && (
        <button
          type="button"
          onClick={addItem}
          class="btn btn-xs btn-outline self-start"
        >
          + Add Entry
        </button>
      )}
    </div>
  );
}
