import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-coral text-white hover:brightness-110",
  ghost: "bg-transparent border border-white/20 text-white hover:bg-white/10",
  danger: "bg-red-500 text-white hover:bg-red-400",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition",
          variantClass[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
