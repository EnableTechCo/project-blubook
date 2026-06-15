import type { ReactNode } from "react";
import { EmptyStateNoticeCard } from "@/components/ui/empty-state-notice-card";

export function NoActiveOrderCtaPanel({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <EmptyStateNoticeCard
      title={title}
      description={description}
      icon={icon}
      action={action}
    />
  );
}
