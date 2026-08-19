// Checks population/coverage (not just schema existence) for the interesting
// fields found in the Book/Series/Edition/Author/List introspection:
// pages, release_date, series membership, edition language, list "reason" text,
// book_characters, book_collections, original_book_id on editions.
import { readFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function gql(query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const q = `
query Sample {
  popular: books(order_by: { users_count: desc }, limit: 25) {
    id title pages release_date description
    book_series { id position series { name } }
    editions(limit: 3) { id language { language } original_book_id publisher { name } pages }
  }
  midtail: books(where: { users_count: { _gte: 50, _lte: 500 } }, order_by: { users_count: desc }, limit: 25) {
    id title pages release_date description
    book_series { id position series { name } }
    editions(limit: 3) { id language { language } original_book_id publisher { name } pages }
  }
  sample_list_books: list_books(where: { list: { books_count: { _gte: 5 } } }, limit: 30) {
    id reason position list { name books_count ranked }
  }
  sample_book_characters: book_characters(limit: 15) {
    id character { name } only_mentioned spoiler
  }
  sample_book_collections: book_collections(limit: 10) {
    id book_id child_book_id position
  }
}
`;

const data = await gql(q);

function pct(n, total) {
  return total === 0 ? "n/a" : `${n}/${total} (${Math.round((100 * n) / total)}%)`;
}

for (const bucket of ["popular", "midtail"]) {
  const books = data[bucket];
  console.log(`\n=== ${bucket} (${books.length} books) ===`);
  console.log(`pages populated: ${pct(books.filter(b => b.pages != null).length, books.length)}`);
  console.log(`release_date populated: ${pct(books.filter(b => b.release_date != null).length, books.length)}`);
  console.log(`description populated: ${pct(books.filter(b => b.description != null && b.description !== "").length, books.length)}`);
  console.log(`has >=1 series membership: ${pct(books.filter(b => b.book_series?.length > 0).length, books.length)}`);
  console.log(`series position non-null (of those in a series): ${pct(
    books.flatMap(b => b.book_series).filter(bs => bs.position != null).length,
    books.flatMap(b => b.book_series).length
  )}`);
  const allEditions = books.flatMap(b => b.editions ?? []);
  console.log(`edition language populated: ${pct(allEditions.filter(e => e.language != null).length, allEditions.length)} of ${allEditions.length} sampled editions`);
  console.log(`edition original_book_id populated: ${pct(allEditions.filter(e => e.original_book_id != null).length, allEditions.length)}`);
  console.log(`edition publisher populated: ${pct(allEditions.filter(e => e.publisher != null).length, allEditions.length)}`);
}

console.log(`\n=== list_books.reason (free-text on curated lists, n=${data.sample_list_books.length}) ===`);
const withReason = data.sample_list_books.filter(lb => lb.reason != null && lb.reason.trim() !== "");
console.log(`populated: ${pct(withReason.length, data.sample_list_books.length)}`);
for (const lb of withReason.slice(0, 5)) {
  console.log(`  [list: ${lb.list.name}] "${lb.reason.slice(0, 150)}"`);
}
console.log(`ranked=true lists in sample: ${pct(data.sample_list_books.filter(lb => lb.list.ranked).length, data.sample_list_books.length)}`);

console.log(`\n=== book_characters sample (n=${data.sample_book_characters.length}) ===`);
console.log(data.sample_book_characters.map(bc => `  ${bc.character?.name ?? "(null)"} — only_mentioned=${bc.only_mentioned}, spoiler=${bc.spoiler}`).join("\n"));

console.log(`\n=== book_collections sample (n=${data.sample_book_collections.length}) ===`);
console.log(JSON.stringify(data.sample_book_collections, null, 1));
