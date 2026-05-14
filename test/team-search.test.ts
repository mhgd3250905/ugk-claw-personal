import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { searchSearXNG, searchAndFormat } from "../src/team/team-search.js";

const ORIGINAL_ENV = process.env.SEARXNG_BASE_URL;

describe("searchSearXNG", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.SEARXNG_BASE_URL = "http://test-searxng:8080";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (ORIGINAL_ENV) process.env.SEARXNG_BASE_URL = ORIGINAL_ENV;
    else delete process.env.SEARXNG_BASE_URL;
  });

  it("returns results on successful response", async () => {
    globalThis.fetch = async (input: string | URL | Request) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            { title: "Test", url: "https://example.com", content: "A result" },
          ],
        }),
      } as Response;
    };

    const resp = await searchSearXNG("test query");
    assert.equal(resp.results?.length, 1);
    assert.equal(resp.results![0].title, "Test");
  });

  it("throws on HTTP error", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    await assert.rejects(
      () => searchSearXNG("test"),
      /SearXNG HTTP 500/,
    );
  });

  it("throws specific message on 403", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as Response);

    await assert.rejects(
      () => searchSearXNG("test"),
      /check settings.yml/,
    );
  });
});

describe("searchAndFormat", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.SEARXNG_BASE_URL = "http://test-searxng:8080";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (ORIGINAL_ENV) process.env.SEARXNG_BASE_URL = ORIGINAL_ENV;
    else delete process.env.SEARXNG_BASE_URL;
  });

  it("aggregates multiple queries", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ title: `Result ${callCount}`, url: `https://r${callCount}.com` }],
        }),
      } as Response;
    };

    const output = await searchAndFormat(["query1", "query2"]);
    assert.equal(callCount, 2);
    assert.ok(output.includes("query1"));
    assert.ok(output.includes("query2"));
    assert.ok(output.includes("Result 1"));
    assert.ok(output.includes("Result 2"));
  });

  it("includes error message for failed queries", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => "error",
    } as Response);

    const output = await searchAndFormat(["failing query"]);
    assert.ok(output.includes("search failed"));
    assert.ok(output.includes("SearXNG HTTP 500"));
  });

  it("handles empty results", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    } as Response);

    const output = await searchAndFormat(["empty"]);
    assert.ok(output.includes("no results"));
  });
});
