// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { SessionBridgeProvider, useSessionBridge } from "./SessionBridge";
import type { CurrentSection } from "../utils/currentSection";

const s24: CurrentSection = { bookId: "lathi", title: "2.4 Zero-State", startBook: 168, endBook: 195 };

function setup() {
  const seen: { renders: number; bridge: ReturnType<typeof useSessionBridge> | null } = { renders: 0, bridge: null };
  function Probe() {
    seen.bridge = useSessionBridge();
    seen.renders += 1;
    return null;
  }
  render(
    <SessionBridgeProvider>
      <Probe />
    </SessionBridgeProvider>,
  );
  return seen;
}

afterEach(cleanup);

describe("SessionBridge current section", () => {
  it("publishes and clears the section", () => {
    const seen = setup();
    expect(seen.bridge?.currentSection).toBeNull();
    act(() => seen.bridge?.publishSection(s24));
    expect(seen.bridge?.currentSection).toEqual(s24);
    act(() => seen.bridge?.publishSection(null));
    expect(seen.bridge?.currentSection).toBeNull();
  });

  it("an equal section is a no-op", () => {
    const seen = setup();
    act(() => seen.bridge?.publishSection(s24));
    const renders = seen.renders;
    act(() => seen.bridge?.publishSection({ ...s24 }));
    expect(seen.renders).toBe(renders);
  });
});
