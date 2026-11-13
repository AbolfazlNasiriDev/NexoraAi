import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * shadcn/ui-style Input — rounded, white, soft lavender focus ring.
 * Light theme only.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#EAE5F3] bg-white px-3.5 py-2 text-sm text-[#242033] shadow-soft transition-all placeholder:text-[#6F6A80]/70 focus:border-[#B69AEF] focus:ring-4 focus:ring-[#EDE5FC]/70 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
