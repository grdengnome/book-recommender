// Errors that mean every later call would fail the same way, so the scorer stops at once and
// saves what it has, instead of marking every remaining reader "not scored":
// - out of API credit (Nov 6);
// - a request the API refuses as invalid (Nov 7: a setting the model doesn't accept).
export class StopScoringError extends Error {}
export class OutOfCreditsError extends StopScoringError {}

export function callFailed(what: string, status: number, data: unknown): Error {
  const detail = JSON.stringify((data as { error?: unknown } | undefined)?.error ?? data).slice(0, 300);
  if (/credit balance/i.test(detail)) return new OutOfCreditsError(`${what}: the API credit balance is too low (top up, then rerun; answers so far are saved)`);
  if (status === 400 && /invalid_request_error/.test(detail)) return new StopScoringError(`${what} was refused as invalid, so every call would fail: ${detail}`);
  return new Error(`${what} failed (${status}): ${detail}`);
}
