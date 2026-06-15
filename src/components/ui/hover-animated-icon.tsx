"use client";

import type { ComponentType } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type AnimatedIconHandle = {
  startAnimation?: () => void;
  stopAnimation?: () => void;
};

type HoverIconProps = {
  className?: string;
  size?: number;
};

type HoverAnimatedIconProps = {
  icon: ComponentType<HoverIconProps>;
  active?: boolean;
  className?: string;
  size?: number;
};

export function HoverAnimatedIcon({
  icon: Icon,
  active = false,
  className,
  size = 16,
}: HoverAnimatedIconProps) {
  const iconRef = useRef<AnimatedIconHandle | null>(null);
  const IconWithRef = Icon as unknown as ComponentType<
    HoverIconProps & { ref?: React.Ref<AnimatedIconHandle> }
  >;

  useEffect(() => {
    if (active) {
      iconRef.current?.startAnimation?.();
      return;
    }

    iconRef.current?.stopAnimation?.();
  }, [active]);

  return (
    <IconWithRef
      ref={iconRef}
      aria-hidden="true"
      className={cn(className)}
      size={size}
    />
  );
}
