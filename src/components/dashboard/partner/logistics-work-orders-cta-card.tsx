import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function LogisticsWorkOrdersCtaCard({
  description,
  children,
}: {
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card title="Logistics Work Orders" description={description}>
      {children}
    </Card>
  );
}
