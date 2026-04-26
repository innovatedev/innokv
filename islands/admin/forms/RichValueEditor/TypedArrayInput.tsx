import { useEffect, useRef, useState } from "preact/hooks";

interface TypedArrayInputProps {
  value: (number | string)[];
  type: string;
  onChange: (v: (number | string)[]) => void;
  disabled?: boolean;
}

export function TypedArrayInput(
  { value, type, onChange, disabled }: TypedArrayInputProps,
) {
  const format = (v: (number | string)[]) => {
    if (!Array.isArray(v)) return "";
    return v.join(", ");
  };

  const [text, setText] = useState(format(value));
  const [hasError, setHasError] = useState(false);
  const focused = useRef(false);

  // Sync from parent only if not focused
  useEffect(() => {
    if (!focused.current) {
      setText(format(value));
      setHasError(false);
    }
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    const isBigInt = type.startsWith("Big");

    try {
      const segments = newText.split(/[,\s]+/)
        .map((x) => x.trim())
        .filter((x) => x !== "");

      const items = segments.map((x) => {
        if (isBigInt) {
          if (!/^-?[0-9]+$/.test(x)) throw new Error("Invalid BigInt");
          return x; // Keep as string for transport
        }
        const n = parseFloat(x);
        if (isNaN(n)) throw new Error("Invalid number");
        return n;
      });

      setHasError(false);
      onChange(items);
    } catch {
      setHasError(true);
    }
  };

  const isBigInt = type.startsWith("Big");

  return (
    <div class="flex flex-col gap-1 w-full max-w-lg">
      <textarea
        class={`textarea textarea-bordered textarea-xs w-full rounded font-mono ${
          hasError ? "textarea-error" : ""
        }`}
        rows={Math.min(5, text.split("\n").length + 1)}
        value={text}
        disabled={disabled}
        onInput={(e) => handleChange((e.target as HTMLTextAreaElement).value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (!hasError) {
            setText(format(value));
          }
        }}
      />
      {hasError && (
        <span class="text-[10px] text-error font-bold px-1">
          Invalid values for {type}.{" "}
          {isBigInt ? "Must be integers." : "Must be numbers."}
        </span>
      )}
    </div>
  );
}
