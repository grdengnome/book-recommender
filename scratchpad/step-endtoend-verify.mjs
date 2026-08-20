// End-to-end verification: hit the real, currently-shipped /api/recommend route
// (Open Library only via the model's adaptive search_books tool loop — Hardcover
// pre-fetch/merge is NOT wired into route.ts yet, only tested standalone) for
// case-3 and case-8, to check whether "The Memory of Love" (or a near-identical
// set) actually shows up in the final 3-pick output, per rubric dimension 6.
const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/recommend`;

const CASES = [
  {
    id: "case-3",
    tasteDescription: "Just something good to read.",
  },
  {
    id: "case-8",
    tasteDescription:
      "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
  },
];

for (const c of CASES) {
  console.log(`\n\n########## ${c.id} ##########`);
  console.log(`taste: "${c.tasteDescription}"`);
  const start = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tasteDescription: c.tasteDescription, evalTag: c.id }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  console.log(`(${Date.now() - start}ms, http ${res.status})`);
  console.log(data.recommendations);
}
