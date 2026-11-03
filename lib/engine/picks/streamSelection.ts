// Streaming for the search loop's model calls (fix PR 1, speed, 2026-10-21). The selection
// answer arrives as {"picks":[{...},{...},{...}]}; streaming it lets recommend.ts start each
// pick's grounding, lookup and card as soon as that pick's object is complete, instead of
// waiting for all three. The screen still gets all three together.
//
// The streaming itself happens in the AI gateway (lib/ai/gateway.ts, streamModel); this file
// holds the engine's side: spotting each complete pick in the streamed text.

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
