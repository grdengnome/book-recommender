// Shared offline harness for engine-level tests: runs the real /api/recommend route (POST in
// route.ts) with no network and no API spend. Global fetch is replaced with canned Anthropic,
// Open Library and Hardcover replies, every outgoing request is captured, and Math.random is
// seeded so the engine's shuffles repeat exactly. The canned books and model answers are
// stand-ins, not real engine output. Runs inside a temp directory, so the trace file and log
// writes don't touch the repo.
//
// Importing this module installs the fetch stub, sets fake keys and changes the working
// directory, so import it only from a test file (each test file runs in its own process).
import { registerHooks } from "node:module";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Resolve the app's "@/..." alias and extensionless relative imports the way Next does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context); // the real Next module
    const base =
      specifier.startsWith("@/") ? path.join(ROOT, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      : null;
    if (base && !path.extname(base)) {
      for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

export const CASE_1 =
  "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.";
export const FAKE_ANTHROPIC_KEY = "sk-ant-FAKE-offline-check-key-0000000000";
export const FAKE_HARDCOVER_TOKEN = "fake-hardcover-token-offline-check-0000";

// --- canned catalog data -------------------------------------------------------------------
const BOOKS = [
  ["Gilead", "Marilynne Robinson"], ["The Go-Between", "L. P. Hartley"], ["Our Souls at Night", "Kent Haruf"],
  ["Stoner", "John Williams"], ["Hotel du Lac", "Anita Brookner"], ["Kokoro", "Natsume Sōseki"],
  ["The Leopard", "Giuseppe Tomasi di Lampedusa"], ["A Month in the Country", "J. L. Carr"],
  ["The Blue Flower", "Penelope Fitzgerald"], ["Train Dreams", "Denis Johnson"],
  ...Array.from({ length: 50 }, (_, i) => [`Sample Book ${String(i + 1).padStart(2, "0")}`, `Sample Author ${i + 1}`]),
];
const workKey = (i: number) => `/works/OL${1000 + i}W`;
const olDoc = (i: number) => ({ key: workKey(i), title: BOOKS[i][0], author_name: [BOOKS[i][1]], subject: ["Fiction", "Psychological fiction", "Quiet"] });
const olWork = (i: number) => ({ key: workKey(i), title: BOOKS[i][0], authors: [{ name: BOOKS[i][1] }] });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let leakTitle: string | null = null; // set by the redaction run only
export function setLeakTitle(title: string | null): void { leakTitle = title; }

function cannedOpenLibrary(url: URL): Response {
  // Page counts (lib/engine/sources/pageCounts.ts), asked only for readers who set a length:
  // every third book is long (600 pages), every third has no count, the rest are short (250).
  if (url.pathname === "/search.json" && url.searchParams.get("q")?.startsWith("key:(")) {
    const keys = [...String(url.searchParams.get("q")).matchAll(/"(\/works\/OL(\d+)W)"/g)];
    return json({ docs: keys.map(([, key, n]) => {
      const i = Number(n) - 1000;
      return i % 3 === 2 ? { key } : { key, number_of_pages_median: i % 3 === 0 ? 600 : 250 };
    }) });
  }
  if (url.pathname === "/search.json") {
    const docs = [0, 1, 2, 3, 10, 11, 12, 13, 14, 15].map(olDoc);
    if (leakTitle) docs.push({ key: "/works/OL9W", title: leakTitle, author_name: ["Leak Author"], subject: [] });
    return json({ docs });
  }
  const subject = url.pathname.match(/^\/subjects\/(.+)\.json$/)?.[1];
  if (subject) {
    const start = subject.length % 7; // different, overlapping slices per subject
    return json({ works: Array.from({ length: 20 }, (_, k) => olWork(start + k)) });
  }
  const work = url.pathname.match(/^\/works\/OL(\d+)W\.json$/);
  if (work) {
    // Two "history and criticism" subjects on every work, so stage H's checker actually runs.
    return json({
      description: "A quiet novel about memory and restraint.",
      subjects: ["Fiction", "English fiction -- History and criticism", "Psychological fiction -- History and criticism"],
    });
  }
  return json({}, 404);
}

function cannedHardcover(body: { query: string; variables: Record<string, unknown> }): Response {
  if (body.query.includes("taggable_counts")) {
    const rows = [];
    for (let i = 0; i < 24; i++) {
      const book = { id: 5000 + i, title: BOOKS[i + 2][0], users_count: 100 * (i + 1), contributions: i === 20 ? [] : [{ author: { name: BOOKS[i + 2][1] } }] };
      rows.push({ count: i < 18 ? 10 - (i % 9) : 1, tag: { tag: "reflective" }, book });
      if (i % 3 === 0) rows.push({ count: 4, tag: { tag: "Emotional" }, book });
    }
    return json({ data: { taggable_counts: rows } });
  }
  if (body.query.includes("query Pages")) {
    const ids = (body.variables.ids as number[]) ?? [];
    return json({ data: { books: ids.map((id) => ({ id, pages: id % 2 === 0 ? 280 : 900 })) } });
  }
  if (body.query.includes("books_by_pk")) {
    return json({ data: { books_by_pk: { description: "Hardcover's description.", cached_tags: { Genre: [{ tag: "Literary" }], Mood: [{ tag: "reflective" }] } } } });
  }
  return json({ errors: [{ message: "unexpected query" }] });
}

// A streamed reply (the search loop streams since fix PR 1): the same message as server-sent
// events, text and tool input split into small deltas so the route's pick scanner and
// message rebuild are exercised.
// The canned reply's shape, as far as sse() reads it.
interface CannedBlock { type: string; text?: string; id?: string; name?: string; input?: unknown }
interface CannedMessage {
  id: string; type: string; role: string; model: unknown; content: CannedBlock[]; stop_reason: string;
  usage: { input_tokens: number; output_tokens: number; output_tokens_details: unknown };
}
type SseEvent = { type: string } & Record<string, unknown>;

function sse(message: CannedMessage): Response {
  const events: SseEvent[] = [{ type: "message_start", message: { ...message, content: [], stop_reason: null, usage: { input_tokens: message.usage.input_tokens } } }];
  const chunks = (str: string) => str.match(/[\s\S]{1,17}/g) ?? [];
  message.content.forEach((block, index) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      for (const c of chunks(block.text ?? "")) events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: c } });
    } else if (block.type === "tool_use") {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } });
      for (const c of chunks(JSON.stringify(block.input))) events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: c } });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: message.stop_reason }, usage: { output_tokens: message.usage.output_tokens, output_tokens_details: message.usage.output_tokens_details } });
  events.push({ type: "message_stop" });
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function cannedAnthropic(body: any): Response {
  const usage = { input_tokens: Math.ceil(JSON.stringify(body).length / 4), output_tokens: 400, output_tokens_details: { thinking_tokens: 150 } };
  const reply = (content: CannedBlock[], stop_reason: string) =>
    body.stream
      ? sse({ id: "msg_offline", type: "message", role: "assistant", model: body.model, content, stop_reason, usage })
      : json({ id: "msg_offline", type: "message", role: "assistant", model: body.model, content, stop_reason, usage });
  const first = body.messages[0]?.content;

  if (body.model === "claude-haiku-4-5") {
    const indexes = [...String(first).matchAll(/<pick index="(\d+)">/g)].map((m) => Number(m[1]));
    return reply([{ type: "text", text: JSON.stringify(indexes.map((index) => ({ index, verdict: "consistent", reason: "Matches the catalog." }))) }], "end_turn");
  }
  if (typeof first === "string" && first.includes("book-tagging platform")) {
    return reply([{ type: "text", text: '["reflective", "Emotional", "not a real tag"]' }], "end_turn");
  }
  // Card writing (lib/engine/cards/writeCards.ts): one call per pick, thinking off.
  if (typeof first === "string" && first.startsWith("<reader_taste>")) {
    const title = String(first).match(/catalog title: (.*)/)?.[1] ?? "";
    const author = String(first).match(/catalog author: (.*)/)?.[1] ?? "";
    return reply([{ type: "text", text: JSON.stringify({
      title, author, hook: "A quiet book that stays with you.", why: "Quiet and restrained.",
      angleHeading: "Restraint as a key", angleText: "Fits the brief.",
    }) }], "end_turn");
  }
  if (body.tools && body.messages.length === 1) {
    return reply([
      { type: "tool_use", id: "toolu_offline_1", name: "search_books", input: { query: "quiet restrained novel", subjects: ["psychological_fiction", "literary_fiction"] } },
      { type: "tool_use", id: "toolu_offline_2", name: "search_books", input: { query: "melancholic character study", subjects: ["english_fiction"] } },
    ], "tool_use");
  }
  // Final answer: the first three candidates of the first pool the model was shown.
  const toolResults = body.messages[body.messages.length - 1].content;
  const pool = JSON.parse(toolResults[0].content).pool.slice(0, 3);
  // Same shape the selection schema enforces (lib/engine/picks/pickSchema.ts).
  const moods = ["melancholic", "tender", "wistful"];
  const picks = pool.map((c: { title: string; author: string }, i: number) => ({
    poolTitle: c.title, poolAuthor: c.author, fitNote: "Quiet and restrained.", mood: moods[i],
  }));
  return reply([{ type: "text", text: JSON.stringify({ picks }) }], "end_turn");
}

// --- fetch stub + capture --------------------------------------------------------------------
// headers: as sent, with key and token values replaced by a placeholder. hasTimeout: whether the
// request carried an abort signal (the engine's per-call timeouts).
export interface Captured { url: string; method: string; headers: Record<string, string>; hasTimeout: boolean; body: string | null }
let captured: Captured[] = [];

function capturedHeaders(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    out[name] = value.replace(FAKE_ANTHROPIC_KEY, "<anthropic key>").replace(FAKE_HARDCOVER_TOKEN, "<hardcover token>");
  });
  return out;
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const body = typeof init?.body === "string" ? init.body : null;
  captured.push({ url: url.href, method: init?.method ?? "GET", headers: capturedHeaders(init), hasTimeout: init?.signal != null, body });
  if (url.hostname === "api.anthropic.com") return cannedAnthropic(JSON.parse(body!));
  if (url.hostname === "api.hardcover.app") return cannedHardcover(JSON.parse(body!));
  if (url.hostname === "openlibrary.org") return cannedOpenLibrary(url);
  throw new Error(`offline check: unexpected request to ${url.href}`);
}) as typeof fetch;

export function seedRandom(seed: number): void {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- runs -------------------------------------------------------------------------------------
const workDir = mkdtempSync(path.join(tmpdir(), "trace-check-"));
process.chdir(workDir); // the route's log and trace paths are taken from cwd at import
process.env.ANTHROPIC_API_KEY = FAKE_ANTHROPIC_KEY;
process.env.HARDCOVER_API_TOKEN = FAKE_HARDCOVER_TOKEN;
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;

export const traceDir = path.join(workDir, ".local", "traces");
export const traceFiles = () => (existsSync(traceDir) ? readdirSync(traceDir).sort() : []);

// Quiet the engine's own console logging during the runs.
const realLog = console.log, realError = console.error;
const { POST } = await import(pathToFileURL(path.join(ROOT, "app/api/recommend/route.ts")).href);

// `body` defaults to eval case 1 as a legacy paragraph; pass another request body to test other inputs.
export async function run(env: Record<string, string | undefined>, body: Record<string, unknown> = { tasteDescription: CASE_1, evalTag: "trace-check-case-1" }) {
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  seedRandom(20261017);
  captured = [];
  const before = traceFiles();
  console.log = () => {};
  console.error = () => {};
  try {
    const res = await POST(new Request("http://localhost/api/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }));
    return { status: res.status, responseText: await res.text(), requests: captured, newTraces: traceFiles().filter((f) => !before.includes(f)) };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

