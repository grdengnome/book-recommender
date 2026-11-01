// The AI contract (decisions 14.1 and 14.3). Engine code never calls a model provider
// directly: it asks lib/ai/gateway.ts for the model assigned to its job, builds its request,
// and sends it through the gateway. Each provider is an adapter that implements AiProvider.
//
// Request and response bodies use Anthropic's Messages API shape for now. A provider-neutral
// shape is added the first time another provider is actually tested (the YAGNI guardrail in
// docs/engineering/contracts-and-adapters.md); that adapter translates to and from this shape.

// One slot per AI job. Which model fills each slot lives in lib/ai/slots.ts.
export type AiJob = "tagMapping" | "selection" | "cardWriting" | "shortening" | "descriptionCheck";

export type ProviderId = "anthropic";

export type AiRequestBody = Record<string, unknown> & { model: string };

export type AiBlock = Record<string, unknown> & { type: string; text?: string };

export type AiMessage = Record<string, unknown> & {
  content?: AiBlock[];
  stop_reason?: string;
  usage?: Record<string, unknown>;
  error?: unknown;
};

export interface AiResponse {
  ok: boolean;
  status: number;
  data: AiMessage;
}

export interface AiCallOptions {
  // Aborts the call after this many milliseconds; the error's name is "TimeoutError".
  timeoutMs?: number;
}

export interface AiProvider {
  id: ProviderId;
  // A readable reason the provider can't be used (e.g. a missing key), or null if it's ready.
  missingConfig(): string | null;
  // Throws on network failure or timeout, like fetch; an error reply comes back with ok: false.
  send(body: AiRequestBody, options?: AiCallOptions): Promise<AiResponse>;
  // Same, streamed: onText receives each piece of answer text as it arrives, and the result
  // is the same message object send would have returned. The body must say stream: true.
  stream(body: AiRequestBody, onText?: (delta: string) => void): Promise<AiResponse>;
}
