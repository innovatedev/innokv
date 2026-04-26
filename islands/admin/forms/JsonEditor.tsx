import { useEffect, useState } from "preact/hooks";

interface JsonEditorProps<T> {
  value: T;
  onChange: (value: T) => void;
  onValidationError: (error: string | null) => void;
  validate?: (value: T) => string | null;
  height?: string;
  isReadOnly?: boolean;
  placeholder?: string;
}

export default function JsonEditor<T>({
  value,
  onChange,
  onValidationError,
  validate,
  height = "h-64",
  isReadOnly = false,
  placeholder = "Enter JSON here...",
}: JsonEditorProps<T>) {
  const [jsonString, setJsonString] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync from parent only when parent value changes significantly
  useEffect(() => {
    if (isFocused) return; // Don't sync while user is typing
    try {
      const currentCanonical = JSON.stringify(value);
      const editorCanonical = JSON.stringify(JSON.parse(jsonString));

      if (currentCanonical !== editorCanonical) {
        setJsonString(JSON.stringify(value, null, 2));
        setError(null);
        onValidationError(null);
      }
    } catch {
      // If editor content is invalid JSON, we don't sync from parent
      // unless the parent value is logically different from the last VALID value we had.
    }
  }, [value]);

  const handleInput = (val: string) => {
    setJsonString(val);
    try {
      const parsed = JSON.parse(val) as T;

      // Custom validation
      if (validate) {
        const validationError = validate(parsed);
        if (validationError) {
          setError(validationError);
          onValidationError(validationError);
          return;
        }
      }

      setError(null);
      onValidationError(null);
      onChange(parsed);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      onValidationError(msg);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="flex flex-col gap-2 w-full relative group">
      <textarea
        class={`textarea textarea-bordered rounded-md font-mono text-xs leading-relaxed ${height} w-full bg-base-100 p-3 resize-y ${
          error ? "textarea-error" : ""
        }`}
        value={jsonString}
        readOnly={isReadOnly}
        onInput={(e) => handleInput((e.target as HTMLTextAreaElement).value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          // On blur, if valid, canonicalize the formatting
          try {
            const parsed = JSON.parse(jsonString);
            setJsonString(JSON.stringify(parsed, null, 2));
          } catch {
            // keep as is if invalid
          }
        }}
        placeholder={placeholder}
      />

      <div class="absolute top-2 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          class={`btn btn-xs ${
            copied
              ? "btn-success"
              : "btn-ghost bg-base-200/50 hover:bg-base-200"
          }`}
          onClick={handleCopy}
          title="Copy JSON"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {error && (
        <div class="text-error text-xs font-bold px-2">
          Error: {error}
        </div>
      )}
    </div>
  );
}
