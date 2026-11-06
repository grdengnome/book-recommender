// Every model the engine may use: which provider serves it and what it costs. A model has to
// be listed here before a slot (lib/ai/slots.ts) or an override setting can use it, so every
// call can be priced in the debug trace.
//
// Prices: USD per million tokens, Anthropic first-party rates (checked 2026-10-17). Cache
// writes are billed at 1.25x input (5-minute TTL) and cache reads at 0.1x input; thinking
// tokens are already counted inside output tokens.
import type { ProviderId } from "../contracts/ai";

export interface ModelInfo {
  provider: ProviderId;
  pricePerMTok: { input: number; output: number };
}

export const MODELS: Record<string, ModelInfo> = {
  "claude-sonnet-5": { provider: "anthropic", pricePerMTok: { input: 2, output: 10 } },
  "claude-haiku-4-5": { provider: "anthropic", pricePerMTok: { input: 1, output: 5 } },
  // Opus 5.5 price checked 2026-11-05.
  "claude-opus-5-5": { provider: "anthropic", pricePerMTok: { input: 4, output: 20 } },
};

export const PRICES_CHECKED = "2026-10-17";
