// Full introspection of Hardcover's Book type and directly-related types
// (Series, Edition, Author/Contributor, List), to see the complete field menu
// rather than testing a specific hypothesis.
// Fetches the ENTIRE schema in a single request (standard introspection query)
// to avoid Hardcover's aggressive per-request rate limiting.
import { readFileSync, writeFileSync } from "fs";

const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

const FULL_INTROSPECTION = `
query IntrospectionQuery {
  __schema {
    types {
      kind
      name
      fields(includeDeprecated: true) {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType { kind name }
            }
          }
        }
      }
    }
  }
}`;

async function gqlWithRetry(query, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1);
      console.error(`Rate limited, waiting ${wait}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
    if (json.data === undefined) throw new Error(`No data field (status ${res.status}): ${text.slice(0, 300)}`);
    return json.data;
  }
  throw new Error("Exceeded max retries due to rate limiting");
}

const data = await gqlWithRetry(FULL_INTROSPECTION);
writeFileSync(
  "/tmp/claude-1000/-workspaces-book-recommender/3390c2a1-5405-4ff3-89c0-df0e0cba1216/scratchpad/hardcover-full-schema.json",
  JSON.stringify(data, null, 2)
);
console.log(`Fetched ${data.__schema.types.length} types. Saved to hardcover-full-schema.json`);
