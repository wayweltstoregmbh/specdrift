"use strict";

function normalizeLine(line) {
  return line
    .toLowerCase()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/[^a-z0-9äöüß ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(normalized) {
  return new Set(normalized.split(" ").filter((token) => token.length > 1));
}

function overlapRatio(a, b) {
  if (a.size === 0) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / a.size;
}

function judgeClaims(store, implementationText) {
  const implLines = implementationText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 0);
  const implSets = implLines.map(tokenSet);
  const exact = new Set(implLines);
  const suggestions = [];
  for (const claim of store.claims) {
    if (claim.claim_type === "boundary") continue;
    const normalized = normalizeLine(claim.source_text);
    if (exact.has(normalized)) {
      suggestions.push({ claim_id: claim.claim_id, verdict: "covered", similarity: 1 });
      continue;
    }
    const claimTokens = tokenSet(normalized);
    let best = 0;
    for (const implSet of implSets) {
      const ratio = overlapRatio(claimTokens, implSet);
      if (ratio > best) best = ratio;
    }
    if (best >= 0.5) {
      suggestions.push({ claim_id: claim.claim_id, verdict: "distorted", similarity: best });
    } else {
      suggestions.push({ claim_id: claim.claim_id, verdict: "missing", similarity: best });
    }
  }
  return suggestions;
}

module.exports = { judgeClaims, normalizeLine };
