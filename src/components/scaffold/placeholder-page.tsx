import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({
  title,
  subtitle,
  phase,
  bullets,
}: {
  title: string;
  subtitle: string;
  phase: string;
  bullets: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <Badge className="mb-3">{phase}</Badge>
        <h2 className="text-3xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-slate-200/85">{subtitle}</p>
      </div>

      <Card
        title="Scaffold Status"
        description="This module is structured and ready for Supabase-powered implementation."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-100/90">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
