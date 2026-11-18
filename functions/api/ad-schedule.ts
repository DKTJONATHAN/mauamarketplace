export const AD_SLOT_CAPACITY: Record<string, number> = {
  homepage_banner: 2,
  category_feature: 2,
  business_spotlight: 3,
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function concurrentCount(
  existing: { start_date: string; end_date: string }[],
  start: string,
  end: string,
): number {
  return existing.filter((row) => overlaps(row.start_date, row.end_date, start, end)).length;
}

/** Prefer requested dates; if capacity is full, queue after the earliest-ending campaign. */
export function assignFairAdSchedule(input: {
  placement: string;
  preferredStart: string;
  durationDays: number;
  existing: { start_date: string; end_date: string }[];
}): { startDate: string; endDate: string; delayed: boolean } {
  const capacity = AD_SLOT_CAPACITY[input.placement] ?? 2;
  let start = input.preferredStart;
  let end = addDays(start, Math.max(1, input.durationDays) - 1);
  let guard = 0;

  while (guard < 400) {
    guard += 1;
    if (concurrentCount(input.existing, start, end) < capacity) {
      return { startDate: start, endDate: end, delayed: start !== input.preferredStart };
    }
    const blockers = input.existing
      .filter((row) => overlaps(row.start_date, row.end_date, start, end))
      .map((row) => row.end_date)
      .sort();
    const next = blockers[0] ? addDays(blockers[0], 1) : addDays(start, 1);
    start = next > start ? next : addDays(start, 1);
    end = addDays(start, Math.max(1, input.durationDays) - 1);
  }
  return { startDate: start, endDate: end, delayed: true };
}
