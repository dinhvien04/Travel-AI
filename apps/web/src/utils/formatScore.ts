export function formatScore(score?: number | null) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }

  return `${Math.round(score * 100)}%`;
}
