import { JSX } from "preact";

export type ButtonProps =
  & (
    | ({ href?: never } & JSX.IntrinsicElements["button"])
    | ({ href: string } & JSX.IntrinsicElements["a"])
  )
  & {
    color?:
      | "brand"
      | "primary"
      | "secondary"
      | "accent"
      | "ghost"
      | "link"
      | "info"
      | "success"
      | "warning"
      | "error";
    variant?: "outline" | "active" | "disabled" | "glass" | "no-animation";
    size?: "lg" | "md" | "sm" | "xs";
    className?: string;
  };

export function Button({
  color = "brand",
  size = "sm",
  variant,
  className = "",
  class: _class = "",
  ...props
}: ButtonProps) {
  const baseClass = "btn";

  // Construct class list
  const classes = [baseClass];

  if (size) classes.push(`btn-${size}`);
  if (variant) classes.push(`btn-${variant}`);

  // Apply specific styles for 'brand' color
  if (color === "brand") {
    classes.push("bg-brand hover:bg-brand/80 text-black border-none");
  } else if (color) {
    classes.push(`btn-${color}`);
  }

  const combinedClass = `${classes.join(" ")} ${className} ${_class}`.trim();

  if (props.href) {
    return (
      <a
        {...(props as JSX.IntrinsicElements["a"])}
        class={combinedClass}
      />
    );
  }

  return (
    <button
      {...(props as JSX.IntrinsicElements["button"])}
      class={combinedClass}
    />
  );
}
