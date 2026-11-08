// Page-count lookups for the length filter (decision 2.25) fail closed and don't trust bad
// replies: tiny counts (ebook and audio records) are unknown, a failed or empty reply isn't
// remembered, batches go out together, and Hardcover sizes books Open Library can't.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearPageCounts, pageCounts } from "@/lib/engine/sources/pageCounts";

type Reply = (url: URL, body: { query: string; variables: { ids?: number[] } } | null) => Response;
async function withCatalogs(reply: Reply, fn: (calls: string[]) => Promise<void>) {
  const realFetch = globalThis.fetch;
  const savedToken = process.env.HARDCOVER_API_TOKEN;
  process.env.HARDCOVER_API_TOKEN = "test-token";
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    return reply(url, init?.body ? JSON.parse(String(init.body)) : null);
  }) as typeof fetch;
  clearPageCounts();
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = realFetch;
    if (savedToken === undefined) delete process.env.HARDCOVER_API_TOKEN;
    else process.env.HARDCOVER_API_TOKEN = savedToken;
  }
}
const ok = (body: unknown) => new Response(JSON.stringify(body));
const keysIn = (url: URL) => [...String(url.searchParams.get("q")).matchAll(/"(\/works\/[^"]+)"/g)].map((m) => m[1]);

test("a page count under 20 (an ebook or audio record) counts as unknown", async () => {
  await withCatalogs((url) => ok({ docs: keysIn(url).map((key, i) => ({ key, number_of_pages_median: [0, 5, 240][i] })) }), async () => {
    const { pages } = await pageCounts([{ olWorkKey: "/works/A" }, { olWorkKey: "/works/B" }, { olWorkKey: "/works/C" }]);
    assert.deepEqual(pages, [undefined, undefined, 240]);
  });
});

test("a failed lookup leaves lengths unknown and isn't remembered", async () => {
  let fail = true;
  await withCatalogs((url) => (fail ? new Response("busy", { status: 503 }) : ok({ docs: keysIn(url).map((key) => ({ key, number_of_pages_median: 250 })) })), async () => {
    const first = await pageCounts([{ olWorkKey: "/works/A" }]);
    assert.deepEqual(first.pages, [undefined]);
    assert.equal(first.report.errors.length, 1);
    fail = false;
    assert.deepEqual((await pageCounts([{ olWorkKey: "/works/A" }])).pages, [250], "asked again next time");
  });
});

test("an empty reply proves nothing and isn't remembered as 'no count'", async () => {
  let empty = true;
  await withCatalogs((url) => ok({ docs: empty ? [] : keysIn(url).map((key) => ({ key, number_of_pages_median: 300 })) }), async () => {
    assert.deepEqual((await pageCounts([{ olWorkKey: "/works/A" }])).pages, [undefined]);
    empty = false;
    assert.deepEqual((await pageCounts([{ olWorkKey: "/works/A" }])).pages, [300]);
  });
});

test("over 100 books go out in batches at the same time, and a found count is remembered", async () => {
  await withCatalogs((url) => ok({ docs: keysIn(url).map((key) => ({ key, number_of_pages_median: 220 })) }), async (calls) => {
    const targets = Array.from({ length: 150 }, (_, i) => ({ olWorkKey: `/works/OL${i}W` }));
    const { pages } = await pageCounts(targets);
    assert.ok(pages.every((p) => p === 220));
    assert.equal(calls.length, 2, "two batches");
    await pageCounts(targets);
    assert.equal(calls.length, 2, "remembered: not asked again");
  });
});

test("Hardcover sizes a book Open Library has no count for", async () => {
  const reply: Reply = (url, body) => body
    ? ok({ data: { books: (body.variables.ids ?? []).map((id) => ({ id, pages: 310 })) } })
    : ok({ docs: keysIn(url).map((key) => ({ key })) });
  await withCatalogs(reply, async () => {
    const { pages } = await pageCounts([{ olWorkKey: "/works/A", hcBookId: 7 }, { olWorkKey: "/works/B" }]);
    assert.deepEqual(pages, [310, undefined]);
  });
});
