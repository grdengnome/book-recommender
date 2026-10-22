// Streaming for the search loop's model calls (fix PR 1, speed, 2026-10-21). The selection
// answer arrives as {"picks":[{...},{...},{...}]}; streaming it lets route.ts start each
// pick's grounding, lookup and card as soon as that pick's object is complete, instead of
// waiting for all three. The screen still gets all three together.
//
// streamMessage rebuilds the same message object the non-streaming API returns (content
// blocks, including thinking with its signature and tool_use with its parsed input;
// stop_reason; usage), so the tool loop, the trace and the grounding check use it exactly as
// before. Plain fetch + server-sent events, no SDK (CLAUDE.md).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Reports each complete object inside the top-level "picks" array, in order, as text
// streams in. Relies on the selection schema's shape: one object holding one array.
export function createPickScanner(onPick: (raw: unknown, index: number) => void) {
  let text = "";
  let scanned = 0;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let start = -1;
  let count = 0;
  return (delta: string) => {
    text += delta;
    for (; scanned < text.length; scanned++) {
      const ch = text[scanned];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{" || ch === "[") {
        if (ch === "{" && stack.length === 2 && stack[0] === "{" && stack[1] === "[") start = scanned;
        stack.push(ch);
      } else if (ch === "}" || ch === "]") {
        stack.pop();
        if (ch === "}" && stack.length === 2 && start !== -1) {
          const slice = text.slice(start, scanned + 1);
          start = -1;
          let raw: unknown = null;
          try {
            raw = JSON.parse(slice);
          } catch {
            // Left to the full-answer checks once the stream ends.
          }
          onPick(raw, count++);
        }
      }
    }
  };
}

type Block = Record<string, unknown> & { type: string };

export interface StreamedMessage {
  ok: boolean;
  status: number;
  data: Record<string, unknown> & { content?: Block[]; stop_reason?: string; usage?: Record<string, unknown> };
}

function mergeUsage(into: Record<string, unknown>, add: Record<string, unknown> | undefined) {
  for (const [k, v] of Object.entries(add ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      into[k] = { ...((into[k] as Record<string, unknown>) ?? {}), ...(v as Record<string, unknown>) };
    } else if (v !== null && v !== undefined) into[k] = v;
  }
}

export async function streamMessage(
  apiKey: string,
  body: Record<string, unknown>,
  onText?: (delta: string) => void,
): Promise<StreamedMessage> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    // The caller's body must already say stream: true, so what it records is what was sent.
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return { ok: false, status: res.status, data };
  }

  const message: StreamedMessage["data"] = { content: [] };
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
        content[event.index as number] = { ...(event.content_block as Block) };
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
