// Pulls a book sample (with full Tag-category taggings incl. user_id) for every
// Tag-category tag with count>100, to extend last session's forced-choice cluster
// scan beyond the top 100. Resumable: skips tag ids already present in the output
// file, so an interrupted run (beta API, token can reset without notice) can continue.
import { readFileSync, existsSync, appendFileSync } from "fs";

const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
const OUT = "scratchpad/hardcover-cooc-full-list.ndjson";
const SAMPLE_SIZE = 30;

const KNOWN_CLUSTER_TAGS = new Set([
  "Loveable Characters", "Unloveable Characters",
  "Strong Character Development", "Weak Character Development",
  "Diverse Characters", "Not Diverse Characters",
  "Character driven", "Plot driven", "A mix driven", "N/A driven",
  "fast-paced", "medium-paced", "slow-paced",
]);

async function gql(query, variables, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = 2000 * (attempt + 1);
      process.stderr.write(`  throttled, waiting ${wait}ms (attempt ${attempt + 1}/${retries})\n`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error("exhausted retries on 429");
}

const allTags = JSON.parse(readFileSync("scratchpad/hardcover-tags-gt100.json", "utf8"));
const targetTags = allTags.filter(t => !KNOWN_CLUSTER_TAGS.has(t.tag));

const already = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
    already.add(JSON.parse(line).queriedTagId);
  }
}
process.stderr.write(`${targetTags.length} target tags, ${already.size} already pulled, ${targetTags.length - already.size} remaining\n`);

const query = `
query($tagId: Int!, $limit: Int!) {
  books(where: { taggings: { tag_id: { _eq: $tagId } } }, limit: $limit) {
    id
    taggings(where: { tag: { tag_category_id: { _eq: 2 } } }) {
      user_id
      tag { id tag count }
    }
  }
}
`;

let done = 0;
for (const t of targetTags) {
  if (already.has(t.id)) continue;
  try {
    const data = await gql(query, { tagId: t.id, limit: SAMPLE_SIZE });
    appendFileSync(OUT, JSON.stringify({ queriedTagId: t.id, queriedTag: t.tag, books: data.books }) + "\n");
    done++;
    process.stderr.write(`[${done}] ${t.tag} (count=${t.count}) -> ${data.books.length} books\n`);
  } catch (e) {
    process.stderr.write(`FAILED on ${t.tag} (id=${t.id}): ${e.message}\n`);
    process.stderr.write(`Stopping so progress isn't lost — rerun to resume.\n`);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 600));
}
process.stderr.write(`Done. ${done} newly pulled this run.\n`);
