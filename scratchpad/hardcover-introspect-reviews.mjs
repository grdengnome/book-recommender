// Introspects Hardcover's GraphQL schema for review-related fields on the `books` type
// (and any standalone review type), to check whether user review text is queryable at all
// before deciding whether it's a usable data source for writing/voice taste signal.
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

// 1. Find all types with "review" in the name
const typeSearch = `
query {
  __schema {
    types {
      name
      kind
    }
  }
}
`;
const typeData = await gql(typeSearch);
const reviewTypes = typeData.__schema.types.filter(t =>
  t.name.toLowerCase().includes("review")
);
console.log("=== Types with 'review' in the name ===");
console.log(reviewTypes.map(t => `${t.name} (${t.kind})`).join("\n"));

// 2. Introspect fields on `books` type for anything review-related
const bookFieldsQuery = `
query {
  __type(name: "books") {
    fields {
      name
      type {
        name
        kind
        ofType { name kind }
      }
    }
  }
}
`;
const bookFieldsData = await gql(bookFieldsQuery);
const bookFields = bookFieldsData.__type?.fields ?? [];
console.log("\n=== Fields on `books` type mentioning 'review' ===");
console.log(
  bookFields
    .filter(f => f.name.toLowerCase().includes("review"))
    .map(f => `${f.name}: ${f.type.name ?? f.type.ofType?.name} (${f.type.kind})`)
    .join("\n")
);

// 3. If a review-ish type exists, dump its fields
for (const rt of reviewTypes) {
  if (rt.kind !== "OBJECT") continue;
  const q = `query { __type(name: "${rt.name}") { fields { name type { name kind ofType { name kind } } } } }`;
  const d = await gql(q);
  console.log(`\n=== Fields on type "${rt.name}" ===`);
  console.log(
    (d.__type?.fields ?? [])
      .map(f => `${f.name}: ${f.type.name ?? f.type.ofType?.name} (${f.type.kind})`)
      .join("\n")
  );
}
