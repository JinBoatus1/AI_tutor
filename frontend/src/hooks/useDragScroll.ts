import { useRef, useCallback, useState } from "react";

const DRAG_THRESHOLD_PX = 4;

/** Click-and-drag panning for overflow scroll containers (e.g. zoomed textbook pages). */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });
  const draggedRef = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-no-drag]")) return;

    const el = ref.current;
    if (!el) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
    draggedRef.current = false;
    setGrabbing(true);
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    const el = ref.current;
    if (!el || s.pointerId !== e.pointerId) return;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.moved = true;
      draggedRef.current = true;
    }
    el.scrollLeft = s.scrollLeft - dx;
    el.scrollTop = s.scrollTop - dy;
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (s.pointerId !== e.pointerId) return;
    s.pointerId = -1;
    setGrabbing(false);
    ref.current?.releasePointerCapture(e.pointerId);
  }, []);

  const shouldIgnoreClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    ref,
    grabbing,
    shouldIgnoreClick,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
