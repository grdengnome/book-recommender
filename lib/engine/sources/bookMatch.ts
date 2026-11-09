// Deciding whether a catalog record is the book we mean, by title and author. Shared by the
// engine (finding a pick's Hardcover record for its card, decision 2.26) and the eval judge's
// catalog lookups, so both always agree on which record is the same book. Hardened against
// subtitles, accents, "&", name order, initials, translated authors and co-authors (Nov 6–7).

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const surname = (name: string) => norm(name).split(" ").pop() ?? "";

// Titles match when their main titles agree after normalising: a subtitle after ":", "(", a dash
// or " - " is ignored ("Salt: A World History" matches "Salt"; "Salt Fat Acid Heat" doesn't).
export const mainTitle = (t: string) => t.split(/\s*[:(—–]\s*|\s+-\s+/)[0];
export function titlesMatch(a: string, b: string): boolean {
  return norm(mainTitle(a)) === norm(mainTitle(b)) || norm(a) === norm(b);
}

export function authorsMatch(wanted: string, candidates: string[]): boolean {
  const s = surname(wanted);
  return !!s && candidates.some((c) => norm(c).split(" ").includes(s));
}

// A stricter author check for a search that had no author filter (title alone), where a common
// title plus a common surname could pick the wrong book. A candidate matches when either:
// - every part of the wanted name appears, in any order ("Kurlansky, Mark"; "Sōseki Natsume";
//   "García Márquez, Gabriel"), or
// - the surname appears and the first given name's initial agrees ("J.R.R. Tolkien" and
//   "John Ronald Reuel Tolkien"; "Ursula K. Le Guin" and "Ursula Le Guin").
// Accents, capitals, punctuation and hyphens are already ignored by norm().
export function authorsMatchStrict(wanted: string, candidates: string[]): boolean {
  // Co-authors ("Amal El-Mohtar and Max Gladstone"): any one of them matching is enough.
  const people = wanted.split(/\s*(?:,|&|\band\b)\s*/i).filter((p) => p.trim().split(/\s+/).length > 1);
  if (people.length > 1) return people.some((p) => authorsMatchStrict(p, candidates));
  const w = norm(wanted).split(" ").filter(Boolean);
  if (!w.length) return false;
  const s = w[w.length - 1];
  return candidates.some((cand) => {
    const c = norm(cand).split(" ").filter(Boolean);
    if (w.every((t) => c.includes(t))) return true;
    if (w.length < 2 || !c.includes(s)) return false;
    // "Surname, Given" lists the given names after the comma; otherwise they come first.
    const given = cand.includes(",") ? norm(cand.split(",").slice(1).join(" ")).split(" ").filter(Boolean) : c.filter((t) => t !== s);
    return given.length > 0 && given[0][0] === w[0][0];
  });
}
