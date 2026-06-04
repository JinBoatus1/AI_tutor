import { useEffect } from "react";

/** The element that actually scrolls inside a pane (innermost known scroller). */
function scrollerWithin(pane: HTMLElement): HTMLElement {
  const inner = pane.querySelector<HTMLElement>(
    ".left-panel-section-note, .reference-page-sidebar"
  );
  if (inner && inner.scrollHeight > inner.clientHeight + 1) return inner;
  if (pane.scrollHeight > pane.clientHeight + 1) return pane;
  return inner ?? pane;
}

/**
 * Two stacked, independently-scrollable panes that ALSO chain: scrolling one
 * past its top or bottom edge continues into the other, so the pair reads as a
 * single continuous scroll while both panes stay on screen. Native
 * `overscroll-behavior` only chains to ANCESTORS, never siblings, so we route
 * the wheel delta to the sibling ourselves — and only at a boundary, so normal
 * in-pane scrolling is untouched (no hijacking, no preventDefault mid-scroll).
 */
export function useChainedSplitScroll(
  containerRef: { current: HTMLElement | null },
  topSelector: string,
  bottomSelector: string,
  enabled: boolean
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaY;
      if (!dy) return; // ignore pure horizontal scroll (textbook image pan)
      const top = container.querySelector<HTMLElement>(topSelector);
      const bottom = container.querySelector<HTMLElement>(bottomSelector);
      if (!top || !bottom) return;

      const target = e.target as Node;
      const inTop = top.contains(target);
      const inBottom = bottom.contains(target);
      if (!inTop && !inBottom) return;

      const active = scrollerWithin(inTop ? top : bottom);
      const other = scrollerWithin(inTop ? bottom : top);

      const atTop = active.scrollTop <= 0;
      const atBottom =
        Math.ceil(active.scrollTop + active.clientHeight) >= active.scrollHeight;

      const wantsMore = (dy < 0 && atTop) || (dy > 0 && atBottom);
      const otherCanScroll = other.scrollHeight > other.clientHeight + 1;
      if (wantsMore && otherCanScroll) {
        other.scrollTop += dy;
        e.preventDefault();
      }
      // otherwise: let the active pane scroll natively (or stop, if both ends hit)
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [containerRef, topSelector, bottomSelector, enabled]);
}
