import { useState, type ComponentType } from "react";
import Link from "next/link";
import type { Route } from "next";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";
import { Button } from "@/components/ui/button";
import { FilePenLineIcon } from "@/components/icons/file-pen-line";
import { MessageSquareMoreIcon } from "@/components/icons/message-square-more";

type LinkItem = {
  href: Route;
  label: string;
};

function getQuickLinkIcon(
  item: LinkItem,
): ComponentType<{ className?: string; size?: number }> {
  const href = item.href.toLowerCase();
  const label = item.label.toLowerCase();

  if (href.includes("request") || label.includes("request")) {
    return MessageSquareMoreIcon;
  }

  return FilePenLineIcon;
}

export function QuickLinksActionBar({ links }: { links: LinkItem[] }) {
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex"
          onMouseEnter={() => setHoveredHref(item.href)}
          onMouseLeave={() =>
            setHoveredHref((current) =>
              current === item.href ? null : current,
            )
          }
        >
          <Button variant="ghost">
            <HoverAnimatedIcon
              icon={getQuickLinkIcon(item)}
              active={hoveredHref === item.href}
              className="mr-1.5 h-4 w-4"
              size={16}
            />
            {item.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
