"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type InsightSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
};

const INSIGHT_SLIDES: InsightSlide[] = [
  {
    id: "throughput",
    title: "Throughput Watch",
    subtitle: "Orders moving through validation and handoff",
    imageSrc:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "handoff-health",
    title: "Handoff Health",
    subtitle: "Open logistics handoffs and SLA pressure",
    imageSrc:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "delivery-signal",
    title: "Delivery Signal",
    subtitle: "Transit-to-delivered conversion trend",
    imageSrc:
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80",
  },
];

export function SidebarInsightsSlider({ isDark }: { isDark: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = INSIGHT_SLIDES[activeIndex] ?? INSIGHT_SLIDES[0]!;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % INSIGHT_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      className={cn(
        "mb-3 w-full overflow-hidden rounded-xl border",
        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white",
      )}
      aria-label="Sidebar insights slider"
    >
      <div className="relative h-[144px] w-full overflow-hidden">
        <Image
          src={activeSlide.imageSrc}
          alt={activeSlide.title}
          fill
          sizes="280px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="space-y-1.5 rounded-md bg-black/78 px-2 py-1.5">
            <p
              className="truncate text-sm font-semibold"
              style={{
                color: "#ffffff",
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            >
              {activeSlide.title}
            </p>
            <p
              className="line-clamp-3 text-xs leading-4"
              style={{
                color: "#ffffff",
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            >
              {activeSlide.subtitle}
            </p>

            <div className="flex items-center gap-1">
              {INSIGHT_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-1.5 w-3 rounded-sm transition",
                    index === activeIndex
                      ? "bg-cyan-400"
                      : "bg-white/45 hover:bg-white/65",
                  )}
                  aria-label={`Show ${slide.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
