// Enforces the reader's length request in code, before the model chooses (decision 2.25): books
// outside the allowed range (the band plus 15% past each edge) are removed from the pool, and so
// are books whose length is unknown. The model then only ever sees books that fit, and the
// grounding check (pickGrounding.ts) guarantees every pick comes from that filtered pool.
import { allowedPages, fitsLength, type LengthBand } from "@/lib/engine/profile/slots";
import { pageCounts, type PageCountReport } from "@/lib/engine/sources/pageCounts";
import type { MergedBookCandidate } from "@/lib/engine/pool/mergeCandidatePools";

export interface LengthFilterStats {
  band: LengthBand;
  allowed: { min?: number; max?: number };
  before: number;
  kept: number;
  outsideRange: number;
  unknownLength: number;
  lookup: PageCountReport;
}

export async function filterByLength(pool: MergedBookCandidate[], band: LengthBand): Promise<{ pool: MergedBookCandidate[]; stats: LengthFilterStats }> {
  const { pages, report } = await pageCounts(pool);
  let outsideRange = 0;
  let unknownLength = 0;
  const kept = pool.filter((_, i) => {
    const p = pages[i];
    if (p === undefined) {
      unknownLength++;
      return false;
    }
    if (!fitsLength(band, p)) {
      outsideRange++;
      return false;
    }
    return true;
  });
  return {
    pool: kept,
    stats: { band, allowed: allowedPages(band), before: pool.length, kept: kept.length, outsideRange, unknownLength, lookup: report },
  };
}
