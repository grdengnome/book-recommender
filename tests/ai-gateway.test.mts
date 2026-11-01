// The AI gateway's promises (decisions 14.1 and 14.3): every AI job has a valid slot, an
// override setting can change a job's model and a bad one falls back safely, and nothing
// outside lib/ai/ calls a model provider or names a model directly.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiConfigError, callModel, modelFor } from "@/lib/ai/gateway";
import { AI_SLOTS } from "@/lib/ai/slots";
import { MODELS } from "@/lib/ai/models";
import type { AiJob } from "@/lib/contracts/ai";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOBS: AiJob[] = ["tagMapping", "selection", "cardWriting", "shortening", "descriptionCheck"];

test("every AI job has a slot with a known, priced model and its own override setting", () => {
  assert.deepEqual(Object.keys(AI_SLOTS).sort(), [...JOBS].sort());
  const overrides = new Set<string>();
  for (const job of JOBS) {
    const slot = AI_SLOTS[job];
    assert.ok(MODELS[slot.model], `${job}: ${slot.model} isn't in lib/ai/models.ts`);
    assert.match(slot.envOverride, /^AI_SLOT_[A-Z_]+$/);
    assert.ok(!overrides.has(slot.envOverride), `${slot.envOverride} is used twice`);
    overrides.add(slot.envOverride);
  }
});

test("a job uses its slot's model unless its override names a known model", () => {
  const name = AI_SLOTS.cardWriting.envOverride;
  const other = Object.keys(MODELS).find((m) => m !== AI_SLOTS.cardWriting.model)!;
  const realWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);
  try {
    delete process.env[name];
    assert.equal(modelFor("cardWriting"), AI_SLOTS.cardWriting.model);

    process.env[name] = other;
    assert.equal(modelFor("cardWriting"), other);
    assert.equal(modelFor("selection"), AI_SLOTS.selection.model, "an override changes only its own job");

    process.env[name] = "claude-misspelled-9";
    assert.equal(modelFor("cardWriting"), AI_SLOTS.cardWriting.model, "an unknown model falls back to the default");
    assert.equal(warnings.length, 1);
  } finally {
    delete process.env[name];
    console.warn = realWarn;
  }
});

test("a missing key is reported before any call is made", () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(aiConfigError(), "ANTHROPIC_API_KEY is not set");
    process.env.ANTHROPIC_API_KEY = "sk-ant-FAKE-test-key";
    assert.equal(aiConfigError(), null);
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("a request for a model that isn't listed is refused, not sent", () => {
  assert.throws(() => callModel({ model: "not-a-real-model", max_tokens: 1, messages: [] }), /unknown model/);
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mts)$/.test(name) ? [full] : [];
  });
}

test("nothing outside lib/ai/ calls a model provider or names a model", () => {
  const aiDir = path.join(ROOT, "lib", "ai") + path.sep;
  const offenders: string[] = [];
  for (const file of [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "lib"))]) {
    if (file.startsWith(aiDir)) continue;
    const text = readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    if (/api\.anthropic\.com|x-api-key|anthropic-version|ANTHROPIC_API_KEY/.test(text)) offenders.push(`${rel}: talks to Anthropic directly`);
    for (const m of text.matchAll(/["'`](claude-[a-z0-9.-]+)["'`]/g)) offenders.push(`${rel}: names model ${m[1]}`);
  }
  assert.deepEqual(offenders, [], "Use lib/ai/gateway.ts (modelFor, callModel, streamModel) instead");
});
