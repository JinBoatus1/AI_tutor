// @vitest-environment jsdom
// Scanned pages get the variant's page filter wherever they show and are never inverted (spec §4.6).
import { afterEach, describe, expect, it } from "vitest";
import { loadAppStyleSheets, resolveInBothOrders } from "./test/cssCascade";

const sheets = loadAppStyleSheets();

afterEach(() => document.body.replaceChildren());

describe("textbook page images", () => {
  it.each([
    ['<div class="reference-page-sidebar"><img class="reference-page-img"></div>', ".reference-page-img"],
    ['<div class="reference-image-lightbox"><img class="reference-image-lightbox-img"></div>', ".reference-image-lightbox-img"],
  ])("filter the scanned page in %s", (html, selector) => {
    document.body.innerHTML = html;
    expect(resolveInBothOrders(document.querySelector(selector)!, "filter", sheets)).toEqual([
      "var(--page-image-filter)",
      "var(--page-image-filter)",
    ]);
  });

  it("leave the student's own screenshots unfiltered", () => {
    document.body.innerHTML = '<img class="msg-user-thumb"><img class="attached-img-thumb">';
    for (const img of document.querySelectorAll("img")) {
      expect(resolveInBothOrders(img, "filter", sheets)).toEqual([undefined, undefined]);
    }
  });
});
