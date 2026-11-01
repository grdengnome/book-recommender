// Read-only diagnostic (2026-09-26): what does Hardcover's GraphQL API return for a
// single-book lookup by ID? Checks description, tag/genre sources (cached_tags,
// taggable_counts with tag category), and book_mappings (possible cross-source IDs).
// Book ID 657 comes from scratchpad/hardcover-candidate-groups-deep.json.
// Usage: node --env-file=.env.local scratchpad/hc-single-book-lookup.mjs [bookId]
const BOOK_ID = Number(process.argv[2] ?? 657);
const token = process.env.HARDCOVER_API_TOKEN;
if (!token) throw new Error("HARDCOVER_API_TOKEN not set");

const query = `
  query OneBook($id: Int!) {
    books_by_pk(id: $id) {
      id
      title
      subtitle
      release_year
      description
      headline
      literary_type_id
      book_category_id
      cached_tags
      contributions(limit: 1) { author { name } }
      taggable_counts(order_by: { count: desc }, limit: 15) {
        count
        tag { id tag tag_category { category } }
      }
      book_mappings(limit: 20) { external_id platform { name } }
    }
  }`;

const res = await fetch("https://api.hardcover.app/v1/graphql", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  },
  body: JSON.stringify({ query, variables: { id: BOOK_ID } }),
});
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(await res.json(), null, 2));
