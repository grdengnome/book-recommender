// Anthropic adapter for the AI contract (lib/contracts/ai.ts). The only code that talks to
// api.anthropic.com: plain fetch to the Messages API, no SDK (CLAUDE.md). Holds the address,
// API version, key and headers, the per-call timeout, and streaming.
//
// stream() rebuilds the same message object the non-streaming API returns (content blocks,
// including thinking with its signature and tool_use with its parsed input; stop_reason;
// usage), so callers use a streamed answer exactly like a plain one.
import type { AiBlock, AiCallOptions, AiMessage, AiProvider, AiRequestBody, AiResponse } from "../contracts/ai";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MISSING_KEY = "ANTHROPIC_API_KEY is not set";

function headers(): Record<string, string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(MISSING_KEY);
  return { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION };
}

async function send(body: AiRequestBody, options: AiCallOptions = {}): Promise<AiResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    ...(options.timeoutMs ? { signal: AbortSignal.timeout(options.timeoutMs) } : {}),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function mergeUsage(into: Record<string, unknown>, add: Record<string, unknown> | undefined) {
  for (const [k, v] of Object.entries(add ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      into[k] = { ...((into[k] as Record<string, unknown>) ?? {}), ...(v as Record<string, unknown>) };
    } else if (v !== null && v !== undefined) into[k] = v;
  }
}

async function stream(body: AiRequestBody, onText?: (delta: string) => void): Promise<AiResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    // The caller's body must already say stream: true, so what it records is what was sent.
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return { ok: false, status: res.status, data };
  }

  const message: AiMessage = { content: [] };
  const partialJson = new Map<number, string>();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = "";
  let streamError: unknown = null;

  const handle = (event: Record<string, unknown>) => {
    const content = message.content!;
    switch (event.type) {
      case "message_start": {
        const start = { ...(event.message as Record<string, unknown>) };
        const usage = start.usage as Record<string, unknown> | undefined;
        delete start.content;
        delete start.usage;
        Object.assign(message, start);
        message.usage = {};
        mergeUsage(message.usage, usage);
        break;
      }
      case "content_block_start":
        content[event.index as number] = { ...(event.content_block as AiBlock) };
        break;
      case "content_block_delta": {
        const i = event.index as number;
        const block = content[i];
        const d = event.delta as Record<string, string>;
        if (d.type === "text_delta") {
          block.text = String(block.text ?? "") + d.text;
          onText?.(d.text);
        } else if (d.type === "thinking_delta") block.thinking = String(block.thinking ?? "") + d.thinking;
        else if (d.type === "signature_delta") block.signature = String(block.signature ?? "") + d.signature;
        else if (d.type === "input_json_delta") partialJson.set(i, (partialJson.get(i) ?? "") + d.partial_json);
        break;
      }
      case "content_block_stop": {
        const i = event.index as number;
        if (content[i]?.type === "tool_use") {
          const json = partialJson.get(i) ?? "";
          content[i].input = json ? JSON.parse(json) : {};
        }
        break;
      }
      case "message_delta":
        Object.assign(message, event.delta as Record<string, unknown>);
        mergeUsage((message.usage ??= {}), event.usage as Record<string, unknown>);
        break;
      case "error":
        streamError = event.error;
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) handle(JSON.parse(dataLine.slice(5).trim()));
    }
    if (done) break;
  }

  if (streamError) return { ok: false, status: 502, data: { error: streamError } };
  return { ok: true, status: res.status, data: message };
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",
  missingConfig: () => (process.env.ANTHROPIC_API_KEY ? null : MISSING_KEY),
  send,
  stream,
};
