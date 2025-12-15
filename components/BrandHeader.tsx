import { APP_VERSION } from "../lib/metadata.ts";

export default function BrandHeader() {
  return (
    <div class="flex flex-col items-center gap-2 select-none">
      <img src="/logo.svg" alt="" class="w-32 h-32 object-contain" />
      <h1
        class="text-3xl font-black tracking-tight"
        style={{
          fontFamily: '"Press Start 2P"',
          color: "#F4892D",
          fontSize: "1.5rem",
        }}
      >
        InnoKV
      </h1>
      <span class="text-xs text-base-content/30 font-mono tracking-widest uppercase">
        v{APP_VERSION}
      </span>
    </div>
  );
}
