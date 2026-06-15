import { cn } from "@/lib/utils";

export function InlineErrorMessage({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p role="alert" className={cn("text-xs text-red-300", className)}>
      {message}
    </p>
  );
}
