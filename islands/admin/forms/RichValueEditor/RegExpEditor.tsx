import { useState } from "preact/hooks";

interface RegExpValue {
  source: string;
  flags: string;
}

interface RegExpEditorProps {
  value: RegExpValue;
  onChange: (v: RegExpValue) => void;
  disabled?: boolean;
}

export function RegExpEditor({ value, onChange, disabled }: RegExpEditorProps) {
  const [source, setSource] = useState(value.source || "");
  const [flags, setFlags] = useState(value.flags || "");

  const update = (s: string, f: string) => {
    setSource(s);
    setFlags(f);
    onChange({ source: s, flags: f });
  };

  return (
    <div class="flex flex-col gap-2 p-2 bg-base-200/30 rounded border border-base-300 max-w-lg">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-bold opacity-50 uppercase">
          Pattern
        </label>
        <div class="flex items-center gap-1">
          <span class="text-base-content/50 font-mono">/</span>
          <input
            type="text"
            class="input input-bordered input-xs flex-1 font-mono"
            value={source}
            disabled={disabled}
            onInput={(e) => update((e.target as HTMLInputElement).value, flags)}
            placeholder="pattern"
          />
          <span class="text-base-content/50 font-mono">/</span>
          <input
            type="text"
            class="input input-bordered input-xs w-16 font-mono"
            value={flags}
            disabled={disabled}
            onInput={(e) =>
              update(source, (e.target as HTMLInputElement).value)}
            placeholder="flags"
          />
        </div>
      </div>
    </div>
  );
}
