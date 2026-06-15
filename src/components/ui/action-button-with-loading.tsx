import { Button } from "@/components/ui/button";

type Tone = "default" | "danger" | "ghost";

export function ActionButtonWithLoading({
  label,
  loadingLabel,
  loading,
  disabled,
  tone = "default",
  className,
  onClick,
}: {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  tone?: Tone;
  className?: string;
  onClick?: () => void;
}) {
  const variant =
    tone === "danger" ? "danger" : tone === "ghost" ? "ghost" : undefined;

  return (
    <Button
      variant={variant}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (loadingLabel ?? "Working...") : label}
    </Button>
  );
}
