// Central tool registry — spec.md Section 5a. Assembles tool definitions for
// the Anthropic API and dispatches incoming tool_use calls to implementations.
// Adding a tool: create lib/tools/yourTool.ts exporting its definition + impl,
// then register it in the two maps below. No other file should need edits.

import {
  searchBooksToolDefinition,
  searchBooks,
  setSearchBooksLogTag,
  type SearchBooksInput,
} from "./searchBooks";

export const toolDefinitions = [searchBooksToolDefinition];

const toolImplementations: Record<string, (input: never) => Promise<unknown>> = {
  search_books: searchBooks as (input: never) => Promise<unknown>,
};

export async function callTool(name: string, input: unknown): Promise<unknown> {
  const impl = toolImplementations[name];
  if (!impl) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return impl(input as never);
}

export type { SearchBooksInput };
// TEMPORARY (query-tracing session, 2026-08-04) — re-exported so route.ts can tag
// search_books calls with the eval case that triggered them. See searchBooks.ts.
export { setSearchBooksLogTag };
