import { ComponentChildren } from "preact";

export function Dropdown({
  label,
  children,
  icon,
  className = "",
  align = "end",
}: {
  label?: string | ComponentChildren;
  children: ComponentChildren;
  icon?: ComponentChildren;
  className?: string;
  align?: "start" | "end" | "center" | "bottom" | "top" | "left" | "right";
}) {
  return (
    <div class={`dropdown dropdown-${align} ${className}`}>
      <div
        tabIndex={0}
        role="button"
        class="btn btn-sm btn-ghost hover:bg-brand/20 hover:text-brand gap-2 transition-colors m-1"
      >
        {icon}
        {label}
      </div>
      <ul
        tabIndex={0}
        class="dropdown-content z-1 menu p-2 shadow bg-base-300 rounded-box w-52 border border-base-200"
      >
        {children}
      </ul>
    </div>
  );
}
