import { useEffect, useRef, useState } from "preact/hooks";

interface NumberInputProps {
  value: number | string;
  onChange: (v: number | string) => void;
  disabled?: boolean;
}

export function NumberInput({ value, onChange, disabled }: NumberInputProps) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(String(value));
    }
  }, [value]);

  const handleInput = (val: string) => {
    setText(val);
    if (val === "NaN" || val === "Infinity" || val === "-Infinity") {
      onChange(val);
      return;
    }

    if (val.trim() === "") {
      return; // Don't trigger change on empty string yet
    }

    const n = Number(val);
    if (!isNaN(n)) {
      onChange(n);
    }
  };

  const setSpecial = (val: string) => {
    setText(val);
    onChange(val);
  };

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <input
          type="text"
          class="input input-bordered input-xs w-full max-w-[150px] font-mono"
          value={text}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setText(String(value));
          }}
          disabled={disabled}
        />
        <div class="flex gap-1">
          <button
            type="button"
            class={`btn btn-xs ${
              text === "NaN" ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setSpecial("NaN")}
            disabled={disabled}
            title="Set as NaN"
          >
            NaN
          </button>
          <button
            type="button"
            class={`btn btn-xs ${
              text === "Infinity" ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setSpecial("Infinity")}
            disabled={disabled}
            title="Set as Positive Infinity"
          >
            +∞
          </button>
          <button
            type="button"
            class={`btn btn-xs ${
              text === "-Infinity" ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setSpecial("-Infinity")}
            disabled={disabled}
            title="Set as Negative Infinity"
          >
            -∞
          </button>
        </div>
      </div>
    </div>
  );
}
