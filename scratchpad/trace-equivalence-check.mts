// Offline check (feat/engine-trace): proves the debug trace only watches. Sends eval case 1's
// taste description through the real /api/recommend route (POST in route.ts) with tracing off,
// then on, and checks that every request the engine sends — above all, every body sent to the
// model — is byte-for-byte identical, and so is the response.
//
// No network and no API spend: global fetch is replaced with canned Anthropic, Open Library and
// Hardcover replies, and Math.random is seeded so the engine's shuffles repeat exactly. The
// canned books and model answers are stand-ins, not real engine output. Runs inside a temp
// directory, so the trace file and query-log.json writes don't touch the repo.
//
// Also checks: no file is written with tracing off, or on Vercel even with ENGINE_TRACE=1;
// all nine stage keys are present; the model input the trace recorded equals what was sent;
// no key or header ends up in the file, and a leaked key value is redacted.
//
// Usage: node scratchpad/trace-equivalence-check.mts [copy-trace-to.json]
// Run it WITHOUT --env-file: it sets fake keys itself and must not see the real ones.
import { registerHooks } from "node:module";
import { existsSync, mkdtempSync, readdirSync, readFileSync, copyFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const CASE_1 =
  "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.";
const FAKE_ANTHROPIC_KEY = "sk-ant-FAKE-offline-check-key-0000000000";
const FAKE_HARDCOVER_TOKEN = "fake-hardcover-token-offline-check-0000";

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

function cannedOpenLibrary(url: URL): Response {
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
  if (body.query.includes("books_by_pk")) {
    return json({ data: { books_by_pk: { description: "Hardcover's description.", cached_tags: { Genre: [{ tag: "Literary" }], Mood: [{ tag: "reflective" }] } } } });
  }
  return json({ errors: [{ message: "unexpected query" }] });
}

function cannedAnthropic(body: any): Response {
  const usage = { input_tokens: Math.ceil(JSON.stringify(body).length / 4), output_tokens: 400, output_tokens_details: { thinking_tokens: 150 } };
  const reply = (content: unknown[], stop_reason: string) =>
    json({ id: "msg_offline", type: "message", role: "assistant", model: body.model, content, stop_reason, usage });
  const first = body.messages[0]?.content;

  if (body.model === "claude-haiku-4-5") {
    const indexes = [...String(first).matchAll(/<pick index="(\d+)">/g)].map((m) => Number(m[1]));
    return reply([{ type: "text", text: JSON.stringify(indexes.map((index) => ({ index, verdict: "consistent", reason: "Matches the catalog." }))) }], "end_turn");
  }
  if (typeof first === "string" && first.includes("book-tagging platform")) {
    return reply([{ type: "text", text: '["reflective", "Emotional", "not a real tag"]' }], "end_turn");
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
  const picks = pool.map((c: { title: string; author: string }) => ({ title: c.title, author: c.author, why: "Quiet and restrained.", nonObvious: "Fits the brief." }));
  return reply([{ type: "text", text: JSON.stringify(picks, null, 2) }], "end_turn");
}

// --- fetch stub + capture --------------------------------------------------------------------
interface Captured { url: string; body: string | null }
let captured: Captured[] = [];

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const body = typeof init?.body === "string" ? init.body : null;
  captured.push({ url: url.href, body });
  if (url.hostname === "api.anthropic.com") return cannedAnthropic(JSON.parse(body!));
  if (url.hostname === "api.hardcover.app") return cannedHardcover(JSON.parse(body!));
  if (url.hostname === "openlibrary.org") return cannedOpenLibrary(url);
  throw new Error(`offline check: unexpected request to ${url.href}`);
}) as typeof fetch;

function seedRandom(seed: number): void {
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

const traceDir = path.join(workDir, "scratchpad", "traces");
const traceFiles = () => (existsSync(traceDir) ? readdirSync(traceDir).sort() : []);

// Quiet the engine's own console logging during the runs.
const realLog = console.log, realError = console.error;
const { POST } = await import(pathToFileURL(path.join(ROOT, "app/api/recommend/route.ts")).href);

async function run(env: Record<string, string | undefined>) {
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
      body: JSON.stringify({ tasteDescription: CASE_1, evalTag: "trace-check-case-1" }),
    }));
    return { status: res.status, responseText: await res.text(), requests: captured, newTraces: traceFiles().filter((f) => !before.includes(f)) };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);
const isModel = (r: Captured) => r.url.startsWith("https://api.anthropic.com/");

const off = await run({ ENGINE_TRACE: undefined, VERCEL: undefined });
const on = await run({ ENGINE_TRACE: "1", VERCEL: undefined });
const vercel = await run({ ENGINE_TRACE: "1", VERCEL: "1" });

const offModel = off.requests.filter(isModel), onModel = on.requests.filter(isModel);
check("same number of model calls, off vs on", offModel.length === onModel.length, `${offModel.length} vs ${onModel.length}`);
const firstDiff = offModel.findIndex((r, i) => r.url !== onModel[i]?.url || r.body !== onModel[i]?.body);
check("every model input byte-identical, off vs on", firstDiff === -1,
  firstDiff === -1 ? `${offModel.length} bodies, ${offModel.reduce((n, r) => n + (r.body?.length ?? 0), 0)} bytes total` : `first difference at model call ${firstDiff + 1}`);
const allSame = off.requests.length === on.requests.length && off.requests.every((r, i) => r.url === on.requests[i].url && r.body === on.requests[i].body);
check("every catalog request identical too, off vs on", allSame, `${off.requests.length - offModel.length} catalog requests`);
check("response identical, off vs on", off.status === on.status && off.responseText === on.responseText, `HTTP ${off.status}`);
check("no trace file with ENGINE_TRACE off", off.newTraces.length === 0);
check("exactly one trace file with ENGINE_TRACE=1", on.newTraces.length === 1, on.newTraces[0] ?? "");
check("no trace file on Vercel even with ENGINE_TRACE=1", vercel.newTraces.length === 0);

const tracePath = path.join(traceDir, on.newTraces[0]);
const traceText = readFileSync(tracePath, "utf8");
const trace = JSON.parse(traceText);
const expectedStages = ["A_tag_picking", "B_hardcover_pool", "C_model_search_loop", "D_open_library_search", "E_merge", "F_grounding_check", "G_pick_lookup", "H_description_check", "I_response"];
check("all nine stage keys present, in order", JSON.stringify(Object.keys(trace.stages)) === JSON.stringify(expectedStages));
check("every stage recorded something", expectedStages.every((k) => trace.stages[k].length > 0),
  expectedStages.map((k) => `${k[0]}:${trace.stages[k].length}`).join(" "));

// The model input the trace recorded is exactly what was sent, call for call.
const tracedModelBodies = expectedStages.flatMap((k) => trace.stages[k]).filter((e: any) => e.kind === "model_call")
  .sort((a: any, b: any) => a.atMs - b.atMs).map((e: any) => JSON.stringify(e.request));
const sentBodies = onModel.map((r) => r.body!);
check("trace's recorded model inputs equal what was sent", tracedModelBodies.length === sentBodies.length && sentBodies.every((b) => tracedModelBodies.includes(b)),
  `${tracedModelBodies.length} recorded`);

const secretsAbsent = ![FAKE_ANTHROPIC_KEY, FAKE_HARDCOVER_TOKEN].some((s) => traceText.includes(s)) && !/x-api-key|authorization|anthropic-version/i.test(traceText);
check("no API key, token, or request header in the trace", secretsAbsent);
const callCosts = expectedStages.flatMap((k) => trace.stages[k]).filter((e: any) => e.kind === "model_call").map((e: any) => e.costUsd);
const summed = Math.round(callCosts.reduce((n: number, c: number) => n + c, 0) * 1e6) / 1e6;
check("every model call priced; total = sum of calls", callCosts.every((c: unknown) => typeof c === "number") && summed === trace.cost.totalUsd,
  `${callCosts.length} calls, total $${trace.cost.totalUsd}`);

// Redaction backstop: if a key value ever reached the data, it's scrubbed from the file.
leakTitle = `Leaked ${FAKE_ANTHROPIC_KEY}`;
const leak = await run({ ENGINE_TRACE: "1", VERCEL: undefined });
leakTitle = null;
const leakText = readFileSync(path.join(traceDir, leak.newTraces[0]), "utf8");
check("a leaked key value is redacted from the file", !leakText.includes(FAKE_ANTHROPIC_KEY) && leakText.includes("[redacted ANTHROPIC_API_KEY]"));

for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
console.log(`trace file: ${(statSync(tracePath).size / 1024).toFixed(0)} KB, ${tracePath}`);
if (process.argv[2]) {
  copyFileSync(tracePath, path.resolve(ROOT, process.argv[2]));
  console.log(`copied to ${process.argv[2]}`);
}
process.exitCode = results.every(([, ok]) => ok) ? 0 : 1;
