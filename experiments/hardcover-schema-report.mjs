import { readFileSync } from "fs";
const data = JSON.parse(
  readFileSync("/tmp/claude-1000/-workspaces-book-recommender/3390c2a1-5405-4ff3-89c0-df0e0cba1216/scratchpad/hardcover-full-schema.json", "utf8")
);
const types = data.__schema.types;
const byName = Object.fromEntries(types.map((t) => [t.name, t]));

function typeName(t) {
  if (!t) return "?";
  if (t.name) return t.name;
  if (t.kind === "LIST") return `[${typeName(t.ofType)}]`;
  if (t.kind === "NON_NULL") return `${typeName(t.ofType)}!`;
  return typeName(t.ofType);
}

function dump(name) {
  const t = byName[name];
  if (!t) {
    console.log(`\n### ${name}: NOT FOUND`);
    return;
  }
  console.log(`\n### ${name} (${t.kind}) — ${t.fields?.length ?? 0} fields`);
  for (const f of t.fields ?? []) {
    console.log(`  ${f.name}: ${typeName(f.type)}`);
  }
}

for (const name of [
  "books", "series", "editions", "authors", "contributions",
  "lists", "list_books", "book_series", "book_categories",
  "book_characters", "book_collections", "book_mappings",
]) {
  dump(name);
}

console.log("\n\n=== Keyword scan across ALL object types' field names ===");
const keywords = ["award", "prize", "similar", "recommend", "theme", "genre", "mood", "translat", "language", "page", "pub", "rank", "trend", "popular"];
for (const t of types) {
  if (t.kind !== "OBJECT" || t.name.startsWith("__")) continue;
  const hits = (t.fields ?? []).filter((f) => keywords.some((k) => f.name.toLowerCase().includes(k)));
  if (hits.length) {
    console.log(`${t.name}: ${hits.map((f) => `${f.name}(${typeName(f.type)})`).join(", ")}`);
  }
}

console.log("\n\n=== Object types with 'award' or 'prize' in the TYPE name ===");
console.log(
  types.filter((t) => /award|prize/i.test(t.name) && !t.name.startsWith("__")).map((t) => `${t.name} (${t.kind})`).join("\n") || "(none)"
);
