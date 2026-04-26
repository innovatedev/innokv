import { RichValue, RichValueType, ValueCodec } from "@/codec/mod.ts";
import { useState } from "preact/hooks";

import RichValueEditor from "./index.tsx";

interface ArrayEditorProps {
  value: RichValue[];
  onChange: (v: RichValue[]) => void;
  depth: number;
  _isSet?: boolean;
  isReadOnly: boolean;
}

export function ArrayEditor(
  { value, onChange, depth, isReadOnly }: ArrayEditorProps,
) {
  // value is array of RichValue
  const list = value || [];
  const [lastType, setLastType] = useState<RichValueType>(
    list.length > 0 ? list[list.length - 1].type : "string",
  );

  const addItem = () => {
    onChange([...list, {
      type: lastType,
      value: ValueCodec.getDefaultValue(lastType),
    }]);
  };

  const removeItem = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, newVal: RichValue) => {
    setLastType(newVal.type);
    const newList = [...list];
    newList[idx] = newVal;
    onChange(newList);
  };

  return (
    <div class="flex flex-col gap-2">
      {list.map((val, idx) => (
        <div
          key={idx}
          class="flex flex-col gap-1 pl-2 border-l border-base-300"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs opacity-50">Item {idx}</span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                class="btn btn-xs btn-ghost text-error"
              >
                Remove
              </button>
            )}
          </div>
          <RichValueEditor
            value={val}
            onChange={(v: RichValue) => updateItem(idx, v)}
            depth={depth}
            isReadOnly={isReadOnly}
          />
        </div>
      ))}
      {!isReadOnly && (
        <button
          type="button"
          onClick={addItem}
          class="btn btn-xs btn-outline self-start"
        >
          + Add Item
        </button>
      )}
    </div>
  );
}
