// Broader sweep: check every OBJECT type in the schema for any field whose name contains
// "review", not just types whose own name contains "review" (script 1 came up empty there).
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

const fullQuery = `
query {
  __schema {
    types {
      name
      kind
      fields {
        name
        type { name kind ofType { name kind ofType { name kind } } }
      }
    }
  }
}
`;
const data = await gql(fullQuery);

console.log("=== Query root fields mentioning 'review' ===");
const queryType = data.__schema.types.find(t => t.name === "query_root" || t.name === "Query");
if (queryType) {
  console.log(
    (queryType.fields ?? [])
      .filter(f => f.name.toLowerCase().includes("review"))
      .map(f => f.name)
      .join("\n") || "(none)"
  );
}

console.log("\n=== All OBJECT types with any field containing 'review' ===");
for (const t of data.__schema.types) {
  if (t.kind !== "OBJECT" || !t.fields) continue;
  const hits = t.fields.filter(f => f.name.toLowerCase().includes("review"));
  if (hits.length) {
    console.log(`\n-- ${t.name} --`);
    for (const f of hits) {
      const typeName = f.type.name ?? f.type.ofType?.name ?? f.type.ofType?.ofType?.name;
      console.log(`  ${f.name}: ${typeName} (${f.type.kind})`);
    }
  }
}

console.log("\n=== Full field list on 'user_books' (if it exists) ===");
const ub = data.__schema.types.find(t => t.name === "user_books");
if (ub) {
  console.log(ub.fields.map(f => f.name).join(", "));
} else {
  console.log("(no type named user_books)");
}
