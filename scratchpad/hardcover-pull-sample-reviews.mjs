// Pulls a small sample of real user_books reviews for books known for distinctive prose
// style, to check whether Hardcover review text contains usable writing/voice signal
// (vs. being purely rating-focused with little substantive text).
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

const targets = [
  { title: "Lolita", author: "Nabokov" },
  { title: "Blood Meridian", author: "McCarthy" },
  { title: "Beloved", author: "Morrison" },
  { title: "Mrs. Dalloway", author: "Woolf" },
  { title: "The Sound and the Fury", author: "Faulkner" },
  { title: "Gilead", author: "Robinson" },
  { title: "Stoner", author: "Williams" },
  { title: "Housekeeping", author: "Robinson" },
];

const findBookQuery = `
query FindBook($title: String!) {
  books(where: { title: { _eq: $title } }, order_by: { users_count: desc }, limit: 5) {
    id
    title
    contributions {
      author { name }
    }
    users_count
    reviews_count
  }
}
`;

const reviewsQuery = `
query BookReviews($bookId: Int!) {
  user_books(
    where: { book_id: { _eq: $bookId }, has_review: { _eq: true } }
    order_by: { review_length: desc }
    limit: 3
  ) {
    rating
    review_length
    review
    review_has_spoilers
  }
}
`;

for (const t of targets) {
  const bookData = await gql(findBookQuery, { title: t.title });
  const candidates = bookData.books ?? [];
  const match = candidates.find(b =>
    b.contributions?.some(c => c.author?.name?.toLowerCase().includes(t.author.toLowerCase()))
  ) ?? candidates[0];

  console.log(`\n${"=".repeat(70)}`);
  if (!match) {
    console.log(`NO MATCH FOUND for "${t.title}" by ${t.author}`);
    continue;
  }
  const authorNames = match.contributions?.map(c => c.author?.name).filter(Boolean).join(", ");
  console.log(`${match.title} — ${authorNames} (book_id=${match.id}, reviews_count=${match.reviews_count})`);
  console.log("=".repeat(70));

  const reviewData = await gql(reviewsQuery, { bookId: match.id });
  const reviews = reviewData.user_books ?? [];
  if (!reviews.length) {
    console.log("  (no reviews with has_review=true found)");
    continue;
  }
  for (const r of reviews) {
    console.log(`\n  --- rating=${r.rating}, length=${r.review_length}, spoilers=${r.review_has_spoilers} ---`);
    console.log(`  ${(r.review ?? "").slice(0, 800)}`);
  }
  await new Promise(res => setTimeout(res, 200));
}
