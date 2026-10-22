// Debug-only per-request trace (feat/engine-trace). With ENGINE_TRACE=1 in .env.local, each
// /api/recommend request writes one JSON file to scratchpad/traces/ holding every stage's
// inputs, outputs, scores, timings, tokens, and dollar cost. Off by default.
//
// Watch-only by construction: nothing here is ever read back by the engine, and every entry
// is deep-copied when it's added, so later mutation of engine data can't change what was
// recorded (and recording can't change the engine data). What the model sees is built
// exactly as before; scratchpad/trace-equivalence-check.mts checks this byte for byte.
//
// Off means off: noopTrace's methods return immediately and nothing is written or printed.
// Callers guard any extra work done only for the trace with `trace.enabled`.
//
// Never on Vercel, whatever ENGINE_TRACE says there, so real users' input is never written.
// The trace is created per request in route.ts and passed down as an argument — never held
// in module state — so concurrent requests can't write into each other's file.
//
// Secrets: entries are built only from request bodies, responses, and engine data — never
// from headers or process.env. As a backstop, the serialized file is scrubbed of the value
// of every secret-looking environment variable before it's written.
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Fixed stage keys, in pipeline order, so traces line up across runs. Every key is always
// present in the file; a stage that didn't run this request has an empty list.
export const TRACE_STAGES = {
  A: "A_tag_picking",
  B: "B_hardcover_pool",
  C: "C_model_search_loop",
  D: "D_open_library_search",
  E: "E_merge",
  F: "F_grounding_check",
  G: "G_pick_lookup",
  // Card writing (fix PR 1): after the lookup, before the description check. Keyed W, not a
  // new letter in sequence, so H and I keep the names earlier traces used.
  W: "W_card_writing",
  H: "H_description_check",
  I: "I_response",
} as const;

export type TraceStage = keyof typeof TRACE_STAGES;

// USD per million tokens, Anthropic first-party rates (checked 2026-10-17). Cache writes are
// billed at 1.25x input (5-minute TTL) and cache reads at 0.1x input; the engine doesn't use
// prompt caching today, so those terms are normally zero. Thinking tokens are already
// counted inside output_tokens. A model missing here is recorded with costUsd: null and
// flagged in the cost summary rather than guessed.
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
const PRICES_CHECKED = "2026-10-17";

export interface ModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  [key: string]: unknown;
}

export function modelCallCostUsd(model: string, usage: ModelUsage | undefined): number | null {
  const price = PRICES_PER_MTOK[model];
  if (!price || !usage) return null;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const usd =
    (input * price.input +
      cacheWrite * price.input * 1.25 +
      cacheRead * price.input * 0.1 +
      output * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export interface ModelCallRecord {
  model: string;
  request: unknown; // the JSON body sent to /v1/messages — never the headers
  response?: unknown; // the parsed response body, when one arrived
  httpStatus?: number;
  ms: number;
  error?: string;
}

export interface RequestTrace {
  readonly enabled: boolean;
  // Returns a view that stamps `fields` (attempt, round, toolUseId...) onto every entry it
  // adds. Shares the same file; used to tie a search back to the model round that asked.
  with(fields: Record<string, unknown>): RequestTrace;
  add(stage: TraceStage, entry: Record<string, unknown>): void;
  modelCall(stage: TraceStage, call: ModelCallRecord): void;
  // Milliseconds since the request started — puts concurrent stages on one timeline.
  sinceStart(): number;
  // Writes the file. Called once per request, at the response; later entries are ignored.
  finish(): void;
}

export const noopTrace: RequestTrace = {
  enabled: false,
  with: () => noopTrace,
  add: () => {},
  modelCall: () => {},
  sinceStart: () => 0,
  finish: () => {},
};

export function isTraceEnabled(): boolean {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  return process.env.ENGINE_TRACE === "1";
}

export interface TraceMeta {
  evalTag: string | null;
  tasteDescription: string;
}

export function createRequestTrace(meta: TraceMeta): RequestTrace {
  return isTraceEnabled() ? new FileTrace(meta) : noopTrace;
}

const TRACE_DIR = path.join(process.cwd(), "scratchpad", "traces");
const SECRET_NAME_PATTERN = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i;
const MIN_SECRET_LENGTH = 8;

// Engine data is plain JSON (API bodies, catalog records), so a JSON round trip is a full
// deep copy and drops anything non-serializable.
function snapshot<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function redactSecrets(text: string): string {
  let out = text;
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < MIN_SECRET_LENGTH || !SECRET_NAME_PATTERN.test(name)) continue;
    out = out.split(value).join(`[redacted ${name}]`);
    // A "Bearer "-prefixed token is also checked without the prefix (preparePool adds it).
    const bare = value.replace(/^Bearer\s+/, "");
    if (bare !== value && bare.length >= MIN_SECRET_LENGTH) out = out.split(bare).join(`[redacted ${name}]`);
  }
  return out;
}

function modelCallEntry(call: ModelCallRecord): Record<string, unknown> {
  const response = call.response as { usage?: ModelUsage; stop_reason?: unknown } | undefined;
  const usage = response?.usage;
  return {
    kind: "model_call",
    model: call.model,
    ms: call.ms,
    ...(call.httpStatus !== undefined ? { httpStatus: call.httpStatus } : {}),
    ...(call.error ? { error: call.error } : {}),
    stopReason: response?.stop_reason ?? null,
    usage: usage ?? null,
    costUsd: modelCallCostUsd(call.model, usage),
    request: call.request,
    response: call.response ?? null,
  };
}

interface StageEntry extends Record<string, unknown> {
  atMs: number;
}

class FileTrace implements RequestTrace {
  readonly enabled = true;
  private readonly id = randomUUID().slice(0, 8);
  private readonly startedAt = new Date();
  private readonly start = performance.now();
  private readonly stages: Record<string, StageEntry[]> = Object.fromEntries(
    Object.values(TRACE_STAGES).map((key) => [key, []]),
  );
  private finished = false;
  private readonly meta: TraceMeta;

  constructor(meta: TraceMeta) {
    this.meta = meta;
  }

  with(fields: Record<string, unknown>): RequestTrace {
    return new TraceView(this, fields);
  }

  add(stage: TraceStage, entry: Record<string, unknown>): void {
    if (this.finished) return;
    this.stages[TRACE_STAGES[stage]].push({ atMs: this.sinceStart(), ...snapshot(entry) });
  }

  modelCall(stage: TraceStage, call: ModelCallRecord): void {
    this.add(stage, modelCallEntry(call));
  }

  sinceStart(): number {
    return Math.round(performance.now() - this.start);
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    try {
      const file = {
        traceVersion: 1,
        requestId: this.id,
        startedAt: this.startedAt.toISOString(),
        evalTag: this.meta.evalTag,
        tasteDescription: this.meta.tasteDescription,
        totalMs: this.sinceStart(),
        cost: this.costSummary(),
        stages: this.stages,
      };
      mkdirSync(TRACE_DIR, { recursive: true });
      const stamp = this.startedAt.toISOString().replace(/[:.]/g, "-");
      const tag = (this.meta.evalTag ?? "untagged").replace(/[^A-Za-z0-9_-]/g, "_");
      const filePath = path.join(TRACE_DIR, `${stamp}-${tag}-${this.id}.json`);
      writeFileSync(filePath, redactSecrets(JSON.stringify(file, null, 2)) + "\n");
      console.log(`engineTrace: wrote ${path.relative(process.cwd(), filePath)}`);
    } catch (err) {
      // A trace must never break the request it's watching.
      console.error("engineTrace: failed to write trace:", err instanceof Error ? err.message : err);
    }
  }

  private costSummary() {
    let totalUsd = 0;
    let calls = 0;
    const unpricedModels = new Set<string>();
    const byStage: Record<string, number> = {};
    const byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; usd: number }> = {};
    for (const [stageKey, entries] of Object.entries(this.stages)) {
      for (const e of entries) {
        if (e.kind !== "model_call") continue;
        calls++;
        const model = String(e.model);
        const usage = (e.usage ?? {}) as ModelUsage;
        const m = (byModel[model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
        m.calls++;
        m.inputTokens += usage.input_tokens ?? 0;
        m.outputTokens += usage.output_tokens ?? 0;
        if (typeof e.costUsd !== "number") {
          unpricedModels.add(model);
          continue;
        }
        m.usd += e.costUsd;
        byStage[stageKey] = (byStage[stageKey] ?? 0) + e.costUsd;
        totalUsd += e.costUsd;
      }
    }
    const round = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
    for (const k of Object.keys(byStage)) byStage[k] = round(byStage[k]);
    for (const m of Object.values(byModel)) m.usd = round(m.usd);
    return {
      totalUsd: round(totalUsd),
      modelCalls: calls,
      byStage,
      byModel,
      ...(unpricedModels.size ? { unpricedModels: [...unpricedModels] } : {}),
      pricesChecked: PRICES_CHECKED,
    };
  }
}

class TraceView implements RequestTrace {
  readonly enabled = true;
  private readonly root: FileTrace;
  private readonly fields: Record<string, unknown>;

  constructor(root: FileTrace, fields: Record<string, unknown>) {
    this.root = root;
    this.fields = fields;
  }

  with(fields: Record<string, unknown>): RequestTrace {
    return new TraceView(this.root, { ...this.fields, ...fields });
  }
  add(stage: TraceStage, entry: Record<string, unknown>): void {
    this.root.add(stage, { ...this.fields, ...entry });
  }
  modelCall(stage: TraceStage, call: ModelCallRecord): void {
    this.add(stage, modelCallEntry(call));
  }
  sinceStart(): number {
    return this.root.sinceStart();
  }
  finish(): void {
    this.root.finish();
  }
}
