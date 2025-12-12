import { forwardRef } from "preact/compat";
import { ComponentChildren } from "preact";

const Dialog = forwardRef<
  HTMLDialogElement,
  { title?: string; children: ComponentChildren }
>(
  ({ children, title }, ref) => {
    return (
      <dialog class="modal" ref={ref}>
        <div class="modal-box">
          <div class="flex w-full justify-between">
            {title ? <h2 class="font-bold text-lg">{title}</h2> : ""}

            <div class="modal-action">
              <button
                type="button"
                class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => {
                  (ref as any)?.current?.close();
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div class="py-4">{children}</div>
        </div>
      </dialog>
    );
  },
);

export default Dialog;
