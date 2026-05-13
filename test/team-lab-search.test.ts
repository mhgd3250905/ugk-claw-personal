import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSearchContext } from "../src/team-lab/search.js";

describe("formatSearchContext", () => {
  it("formats results with title and url", () => {
    const result = formatSearchContext("MED login", [
      { url: "https://example.com", title: "Example", content: "A snippet" },
    ]);
    assert.ok(result.includes("Query: \"MED login\""));
    assert.ok(result.includes("https://example.com"));
    assert.ok(result.includes("Example"));
    assert.ok(result.includes("A snippet"));
  });

  it("truncates long snippets to 200 chars", () => {
    const long = "x".repeat(300);
    const result = formatSearchContext("q", [
      { url: "https://example.com", title: "T", content: long },
    ]);
    assert.ok(result.includes("x".repeat(197) + "..."));
  });

  it("shows (no results) for empty array", () => {
    const result = formatSearchContext("q", []);
    assert.ok(result.includes("(no results)"));
  });

  it("skips entries without url", () => {
    const result = formatSearchContext("q", [
      { title: "No URL" },
      { url: "https://ok.com", title: "OK" },
    ]);
    assert.ok(!result.includes("No URL"));
    assert.ok(result.includes("https://ok.com"));
  });

  it("limits to 10 results", () => {
    const results = Array.from({ length: 15 }, (_, i) => ({
      url: `https://r${i}.com`,
      title: `Result ${i}`,
    }));
    const result = formatSearchContext("q", results);
    assert.ok(result.includes("Result 9"));
    assert.ok(!result.includes("Result 10"));
  });
});
