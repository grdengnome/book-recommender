// Finds real, existing Hardcover tags (any category) matching concepts relevant
// to two eval taste-inputs, so the OL-vs-Hardcover overlap test uses tags that
// actually exist in the vocabulary rather than guessed/invented names.
// Note: Hardcover blocks _ilike server-side (confirmed Aug 5 session on the
// `books` table; same restriction hit here on `tags`), so this pulls all
// count>50 tags via pagination and filters client-side instead.
import { readFileSync, writeFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function gql(query, variables, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = 1500 * (attempt + 1);
      console.error(`Rate limited, waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
    if (json.data === undefined) throw new Error(`No data (status ${res.status}): ${text.slice(0, 300)}`);
    return json.data;
  }
  throw new Error("Exceeded retries due to rate limiting");
}

const pageQuery = `
query TagsPage($limit: Int!, $offset: Int!) {
  tags(where: { count: { _gt: 50 } }, order_by: { count: desc }, limit: $limit, offset: $offset) {
    id
    tag
    slug
    count
    tag_category { category }
  }
}
`;

const all = [];
let offset = 0;
const pageSize = 100;
while (true) {
  const data = await gql(pageQuery, { limit: pageSize, offset });
  all.push(...data.tags);
  process.stderr.write(`offset ${offset}: got ${data.tags.length}\n`);
  if (data.tags.length < pageSize) break;
  offset += pageSize;
  await new Promise(r => setTimeout(r, 400));
}
writeFileSync("scratchpad/hardcover-tags-gt50-allcategories.json", JSON.stringify(all, null, 1));
console.log(`\nTOTAL pulled: ${all.length}`);

const keywordSets = {
  A_vague_literary: ["literary", "quiet", "acclaim", "character"],
  B_texture: ["atmospher", "moral", "grey", "gray", "place", "setting", "ambigu"],
};

for (const [label, kws] of Object.entries(keywordSets)) {
  console.log(`\n=== ${label} ===`);
  for (const kw of kws) {
    const hits = all.filter(t => t.tag.toLowerCase().includes(kw.toLowerCase()));
    console.log(`\n-- keyword: "${kw}" (${hits.length} hits) --`);
    for (const t of hits.slice(0, 12)) {
      console.log(`  [${t.id}] ${t.tag} (${t.tag_category?.category ?? "?"}, count=${t.count})`);
    }
  }
}
