import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-slate-300/60 focus:outline-none focus:ring-2 focus:ring-coral",
        className,
      )}
      {...props}
    />
  );
});
