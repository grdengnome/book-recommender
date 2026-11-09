// Every card gets Hardcover's evidence (decision 2.26), and only for the right book: the engine
// finds an Open Library pick's Hardcover record by title and author with the strict author check,
// so a same-title book by another author (same surname) never feeds a card, and the full title
// is preferred over a subtitle-less match. Offline, with a stand-in Hardcover.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findHardcoverBook } from "@/lib/engine/sources/hardcover/findBook";
import { clearHardcoverSearches, lookupPickMetadata } from "@/lib/engine/verify/lookupPickMetadata";
import { writeCard } from "@/lib/engine/cards/writeCards";

interface Rec { id: number; title: string; author: string; readers: number; description?: string; moods?: string[] }
function stubHardcover(records: Rec[], onModel?: (body: { messages: Array<{ content: string }> }) => void) {
  const realFetch = globalThis.fetch;
  const saved = { token: process.env.HARDCOVER_API_TOKEN, key: process.env.ANTHROPIC_API_KEY };
  process.env.HARDCOVER_API_TOKEN = "test-token";
  process.env.ANTHROPIC_API_KEY = "sk-ant-FAKE-test-key";
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.hostname === "api.hardcover.app") {
      if (body.query.includes("search(")) return new Response(JSON.stringify({ data: { search: { results: { hits: records.map((r) => ({ document: { id: r.id, title: r.title, author_names: [r.author] } })) } } } }));
      const ids: number[] = body.variables.ids;
      return new Response(JSON.stringify({ data: { books: records.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, title: r.title, users_count: r.readers, pages: 200, release_year: 2000, description: r.description ?? "", contributions: [{ author: { name: r.author } }], cached_tags: { Genre: [], Mood: (r.moods ?? []).map((tag) => ({ tag })) } })) } }));
    }
    if (url.hostname === "openlibrary.org") return new Response(JSON.stringify({ description: "Open Library's description." }));
    onModel?.(body);
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ title: "T", author: "A", hook: "h", why: "w", angleHeading: "a", angleText: "t", mood: "" }) }] }));
  }) as typeof fetch;
  clearHardcoverSearches();
  return () => {
    globalThis.fetch = realFetch;
    for (const [k, env] of [["token", "HARDCOVER_API_TOKEN"], ["key", "ANTHROPIC_API_KEY"]] as const) {
      if (saved[k] === undefined) delete process.env[env];
      else process.env[env] = saved[k];
    }
  };
}

test("strict matching rejects a same-title book by another author with the same surname", async () => {
  const restore = stubHardcover([{ id: 1, title: "Collected Poems", author: "Edward Thomas", readers: 5000 }]);
  try {
    assert.equal(await findHardcoverBook("Collected Poems", "Dylan Thomas", { strict: true }), undefined);
    assert.ok(await findHardcoverBook("Collected Poems", "Dylan Thomas"), "the judge's lenient match would have taken it");
  } finally {
    restore();
  }
});

test("strict matching keeps the right author's most-read edition and prefers the full title", async () => {
  const restore = stubHardcover([
    { id: 1, title: "Collected Poems", author: "Edward Thomas", readers: 5000 },
    { id: 2, title: "Collected Poems", author: "Dylan Thomas", readers: 40 },
    { id: 3, title: "Collected Poems", author: "Thomas, Dylan", readers: 900 },
    { id: 4, title: "Collected Poems: 1934-1953", author: "Dylan Thomas", readers: 2000 },
  ]);
  try {
    const book = await findHardcoverBook("Collected Poems", "Dylan Thomas", { strict: true });
    assert.equal(book?.id, 3, "the full-title match wins over the subtitled one; most-read among those; never Edward's");
  } finally {
    restore();
  }
});

test("an Open Library pick's card prompt carries Hardcover's description and moods", async () => {
  let prompt = "";
  const restore = stubHardcover([{ id: 7, title: "The Employees", author: "Olga Ravn", readers: 800, description: "Funny and doom-drenched.", moods: ["funny", "dark"] }], (b) => { prompt = b.messages[0].content; });
  try {
    const checked = { title: "The Employees", author: "Olga Ravn", sources: ["openlibrary"], groundingKey: null, record: { title: "The Employees", author: "Olga Ravn", subjects: ["Fiction"], olWorkKey: "/works/OL9W" } } as never;
    const [meta] = await lookupPickMetadata([checked]);
    await writeCard("A reader who wants darkly funny.", { poolTitle: "The Employees", poolAuthor: "Olga Ravn", fitNote: "fits", mood: "eerie" }, checked, meta, [], undefined, ["gore"]);
    assert.match(prompt, /<reader_avoid>\n- gore\n<\/reader_avoid>/);
    assert.match(prompt, /catalog description: Funny and doom-drenched\./);
    assert.match(prompt, /Hardcover moods: funny; dark/);
    assert.ok(prompt.indexOf("Hardcover moods:") < prompt.indexOf("</book>"));
  } finally {
    restore();
  }
});

test("a repeated pick isn't searched again (Hardcover's rate limit)", async () => {
  let searches = 0;
  const restore = stubHardcover([{ id: 7, title: "The Employees", author: "Olga Ravn", readers: 800, moods: ["funny"] }]);
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    if (String(init?.body ?? "").includes("search(")) searches++;
    return inner(input, init);
  }) as typeof fetch;
  try {
    const checked = { title: "The Employees", author: "Olga Ravn", sources: [], groundingKey: null, record: { title: "The Employees", author: "Olga Ravn", subjects: [], olWorkKey: "/works/OL9W" } } as never;
    await lookupPickMetadata([checked]);
    await lookupPickMetadata([checked]);
    assert.equal(searches, 1);
  } finally {
    restore();
  }
});
