// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  NIGHT_AVAILABLE,
  STORAGE_KEY,
  THEME_OPTIONS,
  applyTheme,
  readTheme,
  resolveTheme,
  writeTheme,
} from "./profileSettings";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("resolveTheme", () => {
  it.each([
    ["default", "paper"],
    ["warm", "paper"],
    ["mint", "paper"],
    ["white", "bright"],
  ])("maps the legacy %s preset to %s", (legacy, expected) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe(expected);
  });

  it.each(["dark", "black"])("maps legacy %s to night only once Night ships", (legacy) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe(NIGHT_AVAILABLE ? "night" : "paper");
  });

  it("lets a valid theme win over a legacy value", () => {
    expect(resolveTheme({ theme: "bright", pageBackground: "dark" })).toBe("bright");
  });

  it.each([null, undefined, "x", 42, [], {}, { theme: "neon" }, { pageBackground: "__proto__" }, { pageBackground: "toString" }])(
    "falls back to paper for %j",
    (stored) => {
      expect(resolveTheme(stored)).toBe("paper");
    },
  );
});

describe("storage", () => {
  it("legacy dark maps to paper until Night ships and storage is untouched", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageBackground: "dark" }));
    expect(readTheme()).toBe(NIGHT_AVAILABLE ? "night" : "paper");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"pageBackground":"dark"}');
  });

  it("reads corrupt JSON as paper", () => {
    localStorage.setItem(STORAGE_KEY, "{bad");
    expect(readTheme()).toBe("paper");
  });

  it("round-trips a written theme", () => {
    writeTheme("bright");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"theme":"bright"}');
    expect(readTheme()).toBe("bright");
  });
});

describe("applyTheme", () => {
  it("sets data-theme for Bright and removes it for Paper", () => {
    applyTheme("bright");
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright");
    applyTheme("paper");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("Night (PR2)", () => {
  it("is offered after Paper and Bright", () => {
    expect(NIGHT_AVAILABLE).toBe(true);
    expect(THEME_OPTIONS).toEqual(["paper", "bright", "night"]);
  });

  it("applies a saved Night choice", () => {
    expect(resolveTheme({ theme: "night" })).toBe("night");
  });

  it.each(["dark", "black"])("lands legacy %s users in Night", (legacy) => {
    expect(resolveTheme({ pageBackground: legacy })).toBe("night");
  });
});
