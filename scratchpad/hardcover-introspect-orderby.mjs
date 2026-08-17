// Targeted introspection for sort/order options on the Hardcover `books` query,
// since the earlier full-schema dump (hardcover-schema-scan.mjs) only requested
// `fields` on types, which returns null for INPUT_OBJECT kinds (order_by, bool_exp
// input types use `inputFields`, not `fields`) and didn't request field `args` either.
// This investigation-only session needs the real sortable fields on books_order_by,
// plus the `books` query's own args, to identify non-users_count ordering strategies.
import { readFileSync, writeFileSync } from "fs";

const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

const QUERY = `
query Introspect {
  __schema {
    queryType {
      fields {
        name
        args {
          name
          type { kind name ofType { kind name ofType { kind name } } }
        }
      }
    }
  }
  booksOrderBy: __type(name: "books_order_by") {
    inputFields {
      name
      type { kind name ofType { kind name ofType { kind name } } }
    }
  }
  booksBoolExp: __type(name: "books_bool_exp") {
    inputFields {
      name
      type { kind name ofType { kind name ofType { kind name } } }
    }
  }
  taggingsOrderBy: __type(name: "taggings_order_by") {
    inputFields {
      name
      type { kind name ofType { kind name ofType { kind name } } }
    }
  }
  bookType: __type(name: "books") {
    fields {
      name
      type { kind name ofType { kind name ofType { kind name } } }
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

const data = await gqlWithRetry(QUERY);
writeFileSync("scratchpad/hardcover-orderby-schema.json", JSON.stringify(data, null, 2));

function typeName(t) {
  if (!t) return "?";
  if (t.name) return t.name;
  if (t.kind === "LIST") return `[${typeName(t.ofType)}]`;
  if (t.kind === "NON_NULL") return `${typeName(t.ofType)}!`;
  return typeName(t.ofType);
}

const booksField = data.__schema.queryType.fields.find(f => f.name === "books");
console.log("=== `books` query args ===");
for (const a of booksField.args) console.log(`  ${a.name}: ${typeName(a.type)}`);

console.log("\n=== books_order_by sortable fields ===");
for (const f of data.booksOrderBy.inputFields) console.log(`  ${f.name}: ${typeName(f.type)}`);

console.log("\n=== taggings_order_by sortable fields (for tag-relevance sort ideas) ===");
if (data.taggingsOrderBy) {
  for (const f of data.taggingsOrderBy.inputFields) console.log(`  ${f.name}: ${typeName(f.type)}`);
} else {
  console.log("  (type not found)");
}

console.log("\n=== books_bool_exp filterable fields (relevant subset) ===");
const relevant = data.booksBoolExp.inputFields.filter(f =>
  /rating|tag|popular|recent|release|publi|score|count|rank/i.test(f.name)
);
for (const f of relevant) console.log(`  ${f.name}: ${typeName(f.type)}`);
