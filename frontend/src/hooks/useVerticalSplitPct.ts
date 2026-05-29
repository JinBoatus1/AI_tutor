import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

function readStoredPct(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? parseFloat(raw) : NaN;
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  } catch {
    return fallback;
  }
}

type UseVerticalSplitPctOptions = {
  storageKey: string;
  defaultPct: number;
  minPct: number;
  maxPct: number;
};

/** Drag a horizontal splitter to set top pane height as % of container. */
export function useVerticalSplitPct({
  storageKey,
  defaultPct,
  minPct,
  maxPct,
}: UseVerticalSplitPctOptions) {
  const [pct, setPct] = useState(() => readStoredPct(storageKey, defaultPct, minPct, maxPct));
  const pctRef = useRef(pct);
  pctRef.current = pct;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPct: number } | null>(null);

  const persist = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  const handleMove = useCallback(
    (e: MouseEvent) => {
      const start = dragRef.current;
      const el = containerRef.current;
      if (!start || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height < 40) return;
      const dy = e.clientY - start.startY;
      const next = Math.min(maxPct, Math.max(minPct, start.startPct + (dy / rect.height) * 100));
      setPct(next);
    },
    [minPct, maxPct]
  );

  const handleEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleEnd);
    persist(pctRef.current);
  }, [handleMove, persist]);

  const onResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startPct: pct };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
    },
    [pct, handleMove, handleEnd]
  );

  useEffect(() => {
    return () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [handleMove, handleEnd]);

  return { pct, setPct, containerRef, onResizeStart };
}
