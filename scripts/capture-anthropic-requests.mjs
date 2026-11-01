// Dev-only preload (2026-09-26, feat/verify-pick-descriptions): records every request body
// sent to the Anthropic Messages API, so we can see exactly what the model receives in
// each search_books tool_result — without adding any logging to production code.
// Usage: NODE_OPTIONS="--import ./scratchpad/capture-anthropic-requests.mjs" \
//        ANTHROPIC_CAPTURE=scratchpad/anthropic-capture.ndjson npm run dev
import { appendFileSync } from "fs";

const OUT = process.env.ANTHROPIC_CAPTURE;
const realFetch = globalThis.fetch;

if (OUT && realFetch) {
  globalThis.fetch = async function capturingFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (url && url.startsWith("https://api.anthropic.com/v1/messages") && typeof init?.body === "string") {
      try {
        appendFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, body: JSON.parse(init.body) }) + "\n");
      } catch {
        // Capture must never break the request.
      }
    }
    return realFetch(input, init);
  };
}
