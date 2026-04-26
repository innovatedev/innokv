import { useEffect, useRef, useState } from "preact/hooks";

interface Uint8ArrayInputProps {
  value: number[];
  onChange: (v: number[]) => void;
  disabled?: boolean;
}

export function Uint8ArrayInput(
  { value, onChange, disabled }: Uint8ArrayInputProps,
) {
  const format = (v: number[]) => {
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
    try {
      const segments = newText.split(/[,\s]+/)
        .map((x) => x.trim())
        .filter((x) => x !== "");

      const bytes = segments.map((x) => {
        const n = parseInt(x);
        if (isNaN(n) || n < 0 || n > 255) throw new Error("Invalid byte");
        return n;
      });

      setHasError(false);
      onChange(bytes);
    } catch {
      setHasError(true);
    }
  };

  return (
    <div class="flex flex-col gap-1 w-full max-w-lg">
      <textarea
        class={`textarea textarea-bordered textarea-xs w-full rounded font-mono ${
          hasError ? "textarea-error" : ""
        }`}
        value={text}
        disabled={disabled}
        onInput={(e) => handleChange((e.target as HTMLTextAreaElement).value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          // On blur, force re-format to canonical ONLY if no error
          if (!hasError) {
            setText(format(value));
          }
        }}
      />
      {hasError && (
        <span class="text-[10px] text-error font-bold px-1">
          Invalid byte array. Must be numbers between 0-255 separated by commas.
        </span>
      )}
    </div>
  );
}
