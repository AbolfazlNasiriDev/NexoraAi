import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "lavender" | "primary" | "outline" | "soft";

const variants: Record<BadgeVariant, string> = {
  lavender: "bg-[#EDE5FC] text-[#6A3FC4]",
  primary: "bg-[#8054D9] text-white",
  outline: "border border-[#EAE5F3] bg-white text-[#6F6A80]",
  soft: "bg-[#F5F1FE] text-[#6F6A80]",
};

/** shadcn/ui-style Badge — small, pill-shaped, light only. */
export function Badge({
  className,
  variant = "lavender",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] leading-5 font-semibold tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
