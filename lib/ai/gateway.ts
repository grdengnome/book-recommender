// The AI gateway (decisions 14.1 and 14.3): the one front door for every model call.
//
// Engine code asks for the model assigned to its job (modelFor), builds its request with that
// model, and sends it with callModel or streamModel. The gateway picks the provider adapter
// that serves the model (lib/ai/models.ts) and hands the request over unchanged. So changing
// which model does a job is one line in lib/ai/slots.ts (or one override setting), and adding
// a provider is one new adapter here; no engine file changes.
import type { AiCallOptions, AiJob, AiProvider, AiRequestBody, AiResponse, ProviderId } from "../contracts/ai";
import { anthropicProvider } from "./anthropic";
import { MODELS } from "./models";
import { AI_SLOTS } from "./slots";

const PROVIDERS: Record<ProviderId, AiProvider> = {
  anthropic: anthropicProvider,
};

const warnedOverrides = new Set<string>();

// The model for a job: its override setting if that names a known model, else the slot's
// default. Read on every call, so a changed setting applies without a restart in tests.
export function modelFor(job: AiJob): string {
  const slot = AI_SLOTS[job];
  const override = process.env[slot.envOverride]?.trim();
  if (!override) return slot.model;
  if (MODELS[override]) return override;
  if (!warnedOverrides.has(override)) {
    warnedOverrides.add(override);
    console.warn(`AI gateway: ${slot.envOverride}=${override} isn't in lib/ai/models.ts; using ${slot.model}`);
  }
  return slot.model;
}

function providerFor(model: string): AiProvider {
  const info = MODELS[model];
  if (!info) throw new Error(`AI gateway: unknown model "${model}"; add it to lib/ai/models.ts`);
  return PROVIDERS[info.provider];
}

// A readable reason the engine can't call its models (e.g. a missing key), or null if every
// provider the current slots use is ready. The recommend route checks this before starting.
export function aiConfigError(): string | null {
  const jobs = Object.keys(AI_SLOTS) as AiJob[];
  const providers = new Set(jobs.map((job) => providerFor(modelFor(job))));
  for (const provider of providers) {
    const problem = provider.missingConfig();
    if (problem) return problem;
  }
  return null;
}

export function callModel(body: AiRequestBody, options?: AiCallOptions): Promise<AiResponse> {
  return providerFor(body.model).send(body, options);
}

export function streamModel(body: AiRequestBody, onText?: (delta: string) => void): Promise<AiResponse> {
  return providerFor(body.model).stream(body, onText);
}
