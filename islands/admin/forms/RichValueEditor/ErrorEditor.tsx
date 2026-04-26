import { RichValue } from "@/codec/mod.ts";

import RichValueEditor from "./index.tsx";

interface ErrorEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  isReadOnly?: boolean;
}

export function ErrorEditor(
  { value, onChange, isReadOnly }: ErrorEditorProps,
) {
  const handleChange = (key: string, val: unknown) => {
    onChange({
      ...value,
      [key]: val,
    });
  };

  return (
    <div class="flex flex-col gap-2 p-2 border border-base-300 rounded bg-base-200/30">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-bold opacity-50 uppercase px-1">
          Name
        </label>
        <input
          type="text"
          class="input input-bordered input-xs w-full"
          value={(value.name as string) || "Error"}
          disabled={isReadOnly}
          onInput={(e) =>
            handleChange("name", (e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-bold opacity-50 uppercase px-1">
          Message
        </label>
        <input
          type="text"
          class="input input-bordered input-xs w-full"
          value={(value.message as string) || ""}
          disabled={isReadOnly}
          onInput={(e) =>
            handleChange("message", (e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-bold opacity-50 uppercase px-1">
          Stack Trace
        </label>
        <textarea
          class="textarea textarea-bordered textarea-xs w-full font-mono text-[10px]"
          rows={3}
          value={(value.stack as string) || ""}
          disabled={isReadOnly}
          onInput={(e) =>
            handleChange("stack", (e.target as HTMLTextAreaElement).value)}
        />
      </div>

      <div class="flex flex-col gap-1 border-t border-base-300 pt-2 mt-1">
        <label class="text-[10px] font-bold opacity-50 uppercase px-1">
          Cause (Recursive)
        </label>
        {value.cause
          ? (
            <div class="relative">
              <RichValueEditor
                value={value.cause as RichValue}
                onChange={(v) => handleChange("cause", v)}
                depth={1}
                label=""
                isReadOnly={isReadOnly}
              />
              {!isReadOnly && (
                <button
                  type="button"
                  class="absolute top-1 right-1 btn btn-xs btn-circle btn-ghost text-error"
                  onClick={() => {
                    const next = { ...value };
                    delete next.cause;
                    onChange(next);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )
          : (
            !isReadOnly && (
              <button
                type="button"
                class="btn btn-xs btn-outline btn-ghost w-full font-normal opacity-50 hover:opacity-100"
                onClick={() =>
                  handleChange("cause", {
                    type: "Error",
                    value: { name: "Error", message: "Nested error" },
                  })}
              >
                + Add Cause
              </button>
            )
          )}
      </div>
    </div>
  );
}
