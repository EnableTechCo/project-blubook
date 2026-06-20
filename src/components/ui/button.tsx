import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-coral text-white hover:brightness-110",
  ghost:
    "bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-100",
  danger: "bg-red-500 text-white hover:bg-red-400",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:-translate-y-0.5 hover:[&_svg]:scale-110",
          variantClass[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
