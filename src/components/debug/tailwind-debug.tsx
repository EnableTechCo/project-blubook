"use client";

import { useEffect } from "react";

export function TailwindDebug() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_DEBUG_TAILWIND !== "1"
    ) {
      return;
    }

    const probe = document.createElement("div");
    probe.className = "text-coral hidden md:block";
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    probe.style.top = "-9999px";
    document.body.appendChild(probe);

    const computed = window.getComputedStyle(probe);
    const hasTailwindUtility = computed.display === "none";
    const coralApplied = computed.color !== "rgb(0, 0, 0)";
    const hasNextCssSheet = Array.from(document.styleSheets).some((sheet) =>
      (sheet.href ?? "").includes("/_next/static/css"),
    );

    console.log("[tailwind-debug]", {
      hasTailwindUtility,
      coralApplied,
      hasNextCssSheet,
      display: computed.display,
      color: computed.color,
    });

    document.body.removeChild(probe);
  }, []);

  return null;
}
