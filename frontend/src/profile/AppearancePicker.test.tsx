// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MessageKey } from "../i18n/messages";

vi.mock("../i18n/LocaleContext", async () => {
  const { formatMessage, MESSAGES } = await vi.importActual<typeof import("../i18n/messages")>("../i18n/messages");
  return {
    useLocale: () => ({
      locale: "en",
      t: (key: MessageKey, vars?: Record<string, string>) => formatMessage(MESSAGES.en[key], vars),
    }),
  };
});

import AppearancePicker from "./AppearancePicker";
import { ProfileSettingsProvider } from "../context/ProfileSettingsContext";
import { STORAGE_KEY } from "./profileSettings";

function renderPicker() {
  return render(
    <ProfileSettingsProvider>
      <AppearancePicker />
    </ProfileSettingsProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("AppearancePicker", () => {
  it("offers Paper and Bright as radios and checks the saved one", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "bright" }));
    renderPicker();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Paper", "Bright"]);
    expect(screen.getByRole("radio", { name: "Bright" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
  });

  it("applies and stores a choice", () => {
    renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "Bright" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("bright");
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"theme":"bright"}');
    fireEvent.click(screen.getByRole("radio", { name: "Paper" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("pins each preview to its own variant", () => {
    const { container } = renderPicker();
    const previews = [...container.querySelectorAll(".theme-tile-preview")];
    expect(previews.map((p) => p.getAttribute("data-theme"))).toEqual(["paper", "bright"]);
  });
});
