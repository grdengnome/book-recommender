// Re-pulls the full Tag-category, count>100 tag list from Hardcover's GraphQL API.
// Last session's equivalent file (hardcover-tags-gt100.json) was lost between sessions
// (untracked scratchpad state); this rebuilds it from scratch via offset-based pagination
// (API caps any single response at 100 rows regardless of requested limit).
const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function gql(query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": auth },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const query = `
query TagsPage($limit: Int!, $offset: Int!) {
  tags(
    where: { count: { _gt: 100 }, tag_category: { category: { _eq: "Tag" } } }
    order_by: { count: desc }
    limit: $limit
    offset: $offset
  ) {
    id
    tag
    slug
    count
    tag_category_id
  }
}
`;

const all = [];
let offset = 0;
const pageSize = 100;
while (true) {
  const data = await gql(query, { limit: pageSize, offset });
  const page = data.tags;
  all.push(...page);
  process.stderr.write(`offset ${offset}: got ${page.length}\n`);
  if (page.length < pageSize) break;
  offset += pageSize;
  await new Promise(r => setTimeout(r, 200));
}

console.log(JSON.stringify(all, null, 1));
process.stderr.write(`TOTAL: ${all.length}\n`);
