import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "lavender";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#8054D9] to-[#9D7BE8] text-white shadow-[0_10px_24px_rgb(128_84_217/0.35)] hover:shadow-[0_14px_32px_rgb(128_84_217/0.45)] hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-[#EDE5FC] text-[#6A3FC4] hover:bg-[#E2D6FB] active:scale-[0.98]",
  outline:
    "border border-[#EAE5F3] bg-white text-[#242033] hover:border-[#B69AEF] hover:bg-[#F5F1FE] active:scale-[0.98]",
  ghost:
    "text-[#6F6A80] hover:bg-[#F5F1FE] hover:text-[#242033] active:scale-[0.98]",
  lavender:
    "bg-white/80 text-[#6A3FC4] shadow-soft backdrop-blur hover:bg-white active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-sm gap-2 rounded-2xl",
  icon: "h-10 w-10 rounded-xl justify-center",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * shadcn/ui-style Button — hand-written for Nexora AI.
 * Primary actions use the Nexora purple gradient; everything else stays
 * light, soft and border-based. Light theme only.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8054D9]/50 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button };
