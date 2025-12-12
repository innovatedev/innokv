import { useSignal } from "@preact/signals";
import type { JSX } from "preact";

export default function DemoIsland(): JSX.Element {
  const count = useSignal(0);

  return (
    <div class="flex items-center justify-between w-48">
      <button class="btn" type="button" onClick={() => (count.value -= 2)}>
        -2
      </button>
      <p style="font-variant-numeric: tabular-nums;">{count}</p>
      <button class="btn" type="button" onClick={() => (count.value += 2)}>
        +2
      </button>
    </div>
  );
}
