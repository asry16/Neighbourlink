/**
 * Next tracking code for a prefix and year, e.g. "INC-2026-0051". Uses the
 * highest existing number rather than a row count, so seeded or deleted
 * records can't cause a duplicate.
 */
export function nextTrackingCode(prefix: string, year: number, existing: string[]): string {
  const stem = `${prefix}-${year}-`;
  const max = existing.reduce((m, code) => {
    if (!code.startsWith(stem)) return m;
    const n = Number.parseInt(code.slice(stem.length), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${stem}${String(max + 1).padStart(4, "0")}`;
}
