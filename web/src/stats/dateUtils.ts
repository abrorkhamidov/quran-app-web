export function isoAddDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dow(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}

// Columns of weeks (each a 7-length array of date strings, Sun..Sat), last column contains `end`.
export function buildHeatmapWeeks(end: string, weeks = 17): string[][] {
  const lastSat = isoAddDays(end, 6 - dow(end));
  let d = isoAddDays(lastSat, -(weeks * 7 - 1));
  const cols: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let i = 0; i < 7; i++) { col.push(d); d = isoAddDays(d, 1); }
    cols.push(col);
  }
  return cols;
}

export function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoAddDays(end, -i));
  return out;
}
