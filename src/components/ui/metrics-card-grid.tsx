import {
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";

type MetricsCardItem = {
  key: string;
  title: string;
  description?: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string; size?: number }>;
  valueClassName?: string;
  cardClassName?: string;
  titleClampLines?: number;
  descriptionClampLines?: number;
};

function buildClampStyle(lines?: number): CSSProperties | undefined {
  if (!lines || lines < 1) {
    return undefined;
  }

  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

export function MetricsCardGrid({
  items,
  loading,
  loadingValue = "-",
  minCardWidth = 220,
  className,
}: {
  items: MetricsCardItem[];
  loading?: boolean;
  loadingValue?: ReactNode;
  minCardWidth?: number;
  className?: string;
}) {
  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);

  return (
    <div
      className={cn("grid gap-4", className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
      }}
    >
      {items.map((item) => (
        <section
          key={item.key}
          onMouseEnter={() => setHoveredCardKey(item.key)}
          onMouseLeave={() =>
            setHoveredCardKey((current) =>
              current === item.key ? null : current,
            )
          }
          className={cn(
            "group surface rounded-2xl p-5 shadow-panel",
            item.cardClassName,
          )}
        >
          <h3
            className="text-lg font-semibold text-slate-900"
            style={buildClampStyle(1)}
            title={item.title}
          >
            {item.title}
          </h3>
          {item.description ? (
            <p
              className="mt-1 min-h-[2.5rem] text-sm leading-5 text-slate-600"
              style={buildClampStyle(2)}
              title={item.description}
            >
              {item.description}
            </p>
          ) : null}
          <div
            className={cn(
              "mt-4 flex items-center justify-between gap-2 text-3xl font-semibold text-slate-900",
              item.valueClassName,
            )}
          >
            <p>{loading ? loadingValue : item.value}</p>
            {item.icon ? (
              <HoverAnimatedIcon
                icon={item.icon}
                active={hoveredCardKey === item.key}
                className="pointer-events-none inline-flex items-center justify-center text-inherit"
                size={24}
              />
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
