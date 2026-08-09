// Deeper, paginated book pull (up to 100/page, same cap as tags) for the 5 candidate
// same-axis groups surfaced by eyeballing the tag-name list, to get a large enough
// joint sample for a trustworthy co-occurrence + per-user decomposition check.
import { writeFileSync } from "fs";

const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

const TAG_IDS = {
  "Male MC": null, "Female MC": null,
  "MF": null, "m-m": null,
  "male author": null, "female author": null,
  "third person POV": null, "first-person-pov": null,
  "dual-pov": null, "Multiple POV's": null,
};

async function gql(query, variables, retries = 6) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1);
      process.stderr.write(`  throttled, waiting ${wait}ms\n`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error("exhausted retries");
}

// Resolve tag ids from the already-pulled tag list
import { readFileSync } from "fs";
const allTags = JSON.parse(readFileSync("scratchpad/hardcover-tags-gt100.json", "utf8"));
for (const t of allTags) if (t.tag in TAG_IDS) TAG_IDS[t.tag] = t.id;
process.stderr.write(JSON.stringify(TAG_IDS) + "\n");

const bookQuery = `
query($tagId: Int!, $limit: Int!, $offset: Int!) {
  books(where: { taggings: { tag_id: { _eq: $tagId } } }, limit: $limit, offset: $offset, order_by: { id: asc }) {
    id
    taggings(where: { tag: { tag_category_id: { _eq: 2 } } }) {
      user_id
      tag { id tag }
    }
  }
}
`;

const PAGE = 100;
const MAX_BOOKS = 200;
const results = {};
for (const [tagName, tagId] of Object.entries(TAG_IDS)) {
  if (!tagId) { process.stderr.write(`MISSING TAG ID for ${tagName}\n`); continue; }
  let offset = 0;
  const all = [];
  while (offset < MAX_BOOKS) {
    const data = await gql(bookQuery, { tagId, limit: PAGE, offset });
    all.push(...data.books);
    process.stderr.write(`${tagName}: offset ${offset} -> ${data.books.length}\n`);
    if (data.books.length < PAGE) break;
    offset += PAGE;
    await new Promise(r => setTimeout(r, 500));
  }
  results[tagName] = all;
  await new Promise(r => setTimeout(r, 500));
}

writeFileSync("scratchpad/hardcover-candidate-groups-deep.json", JSON.stringify(results));
process.stderr.write("Done.\n");
