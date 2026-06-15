export function UploadFlowProgressRail({ percent }: { percent: number }) {
  return (
    <div className="relative pt-6">
      <div className="h-2 rounded-full bg-white/10" />
      <div
        className="absolute left-0 top-6 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
