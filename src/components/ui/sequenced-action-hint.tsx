export function SequencedActionHint({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className={className ?? "mb-3 text-[11px] text-slate-300/90"}>
      {message}
    </p>
  );
}
