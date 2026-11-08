// Out of API credit: every later call would fail the same way, so the scorer stops at once and
// saves what it has, instead of marking every remaining reader "not scored" (Nov 6).
export class OutOfCreditsError extends Error {}

export function callFailed(what: string, status: number, data: unknown): Error {
  const detail = JSON.stringify((data as { error?: unknown } | undefined)?.error ?? data).slice(0, 300);
  if (/credit balance/i.test(detail)) return new OutOfCreditsError(`${what}: the API credit balance is too low (top up, then rerun; answers so far are saved)`);
  return new Error(`${what} failed (${status}): ${detail}`);
}
