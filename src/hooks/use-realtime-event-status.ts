"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UseRealtimeEventStatusInput = {
  staleAfterSeconds?: number;
  tickIntervalMs?: number;
};

export function useRealtimeEventStatus(input?: UseRealtimeEventStatusInput) {
  const staleAfterSeconds = input?.staleAfterSeconds ?? 30;
  const tickIntervalMs = input?.tickIntervalMs ?? 10_000;
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<string | null>(
    null,
  );
  const [realtimeClock, setRealtimeClock] = useState(() => Date.now());

  const markRealtimeEvent = useCallback(() => {
    setLastRealtimeEventAt(new Date().toISOString());
    setRealtimeClock(Date.now());
  }, []);

  useEffect(() => {
    if (!lastRealtimeEventAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRealtimeClock(Date.now());
    }, tickIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastRealtimeEventAt, tickIntervalMs]);

  const lastRealtimeAgeSeconds = useMemo(() => {
    if (!lastRealtimeEventAt) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (realtimeClock - new Date(lastRealtimeEventAt).getTime()) / 1000,
      ),
    );
  }, [lastRealtimeEventAt, realtimeClock]);

  const realtimeStatusClassName = useMemo(() => {
    if (lastRealtimeAgeSeconds === null) {
      return "text-slate-400";
    }

    if (lastRealtimeAgeSeconds > staleAfterSeconds) {
      return "text-amber-200";
    }

    return "text-emerald-200";
  }, [lastRealtimeAgeSeconds, staleAfterSeconds]);

  const realtimeStatusLabel = useMemo(() => {
    if (lastRealtimeAgeSeconds === null) {
      return "Waiting for realtime event";
    }

    if (lastRealtimeAgeSeconds > staleAfterSeconds) {
      return `Stale (${lastRealtimeAgeSeconds}s ago)`;
    }

    return `Fresh (${lastRealtimeAgeSeconds}s ago)`;
  }, [lastRealtimeAgeSeconds, staleAfterSeconds]);

  return {
    lastRealtimeEventAt,
    lastRealtimeAgeSeconds,
    realtimeStatusClassName,
    realtimeStatusLabel,
    markRealtimeEvent,
  };
}
