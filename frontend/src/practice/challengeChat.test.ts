import { describe, it, expect } from "vitest";
import { extractReply } from "./challengeChat";

describe("extractReply (ignores matched_topic / reference fields)", () => {
  it("returns only the reply, dropping matching/reference fields", () => {
    const data = {
      reply: "  Use contraposition.  ",
      matched_topic: { name: "4.2 Proof by Contraposition" },
      reference_section_pages_b64: ["BIGBASE64..."],
    } as Record<string, unknown>;
    expect(extractReply(data)).toBe("Use contraposition.");
  });

  it("falls back to detail/error when no reply", () => {
    expect(extractReply({ detail: "rate limited" })).toBe("rate limited");
    expect(extractReply({ error: "boom" })).toBe("boom");
  });

  it("empty when nothing usable", () => {
    expect(extractReply({})).toBe("");
  });
});
