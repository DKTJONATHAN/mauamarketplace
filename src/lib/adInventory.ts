/** Concurrent campaign capacity per placement. When full, new paid campaigns are queued after existing ones. */
export const AD_SLOT_CAPACITY: Record<'homepage_banner' | 'category_feature' | 'business_spotlight', number> = {
  homepage_banner: 2,
  category_feature: 2,
  business_spotlight: 3,
};

export type AdScheduleInput = {
  placement: 'homepage_banner' | 'category_feature' | 'business_spotlight';
  preferredStart: string; // YYYY-MM-DD
  durationDays: number;
  /** Existing campaigns that occupy inventory (pending review, scheduled, or active). */
  existing: { start_date: string; end_date: string }[];
};

export type AdScheduleResult = {
  startDate: string;
  endDate: string;
  delayed: boolean;
  reason?: string;
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Count how many existing campaigns overlap a candidate window. */
function concurrentCount(
  existing: { start_date: string; end_date: string }[],
  start: string,
  end: string,
): number {
  return existing.filter((row) => overlaps(row.start_date, row.end_date, start, end)).length;
}

/**
 * Assign a fair start/end window for a paid campaign.
 * Prefer the buyer's requested start date when capacity remains;
 * otherwise queue immediately after the earliest-ending overlapping campaign.
 */
export function assignFairAdSchedule(input: AdScheduleInput): AdScheduleResult {
  const capacity = AD_SLOT_CAPACITY[input.placement];
  let start = input.preferredStart;
  let end = addDays(start, Math.max(1, input.durationDays) - 1);
  let guard = 0;

  while (guard < 400) {
    guard += 1;
    if (concurrentCount(input.existing, start, end) < capacity) {
      return {
        startDate: start,
        endDate: end,
        delayed: start !== input.preferredStart,
        reason:
          start !== input.preferredStart
            ? `This placement was fully booked for your preferred dates. Your campaign is queued to start on ${start}.`
            : undefined,
      };
    }
    // Move to the day after the soonest-ending campaign that blocks this window.
    const blockers = input.existing
      .filter((row) => overlaps(row.start_date, row.end_date, start, end))
      .map((row) => row.end_date)
      .sort();
    const next = blockers[0] ? addDays(blockers[0], 1) : addDays(start, 1);
    start = next > start ? next : addDays(start, 1);
    end = addDays(start, Math.max(1, input.durationDays) - 1);
  }

  return {
    startDate: start,
    endDate: end,
    delayed: true,
    reason: 'This placement is busy. Your campaign was placed at the next available window.',
  };
}

/** Stable rotation index so concurrent ads share exposure fairly across the day. */
export function rotationIndex(seed: string, bucketCount: number, now = new Date()): number {
  if (bucketCount <= 1) return 0;
  const hourBucket = Math.floor(now.getTime() / (15 * 60 * 1000)); // rotate every 15 minutes
  let hash = hourBucket;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % bucketCount;
}

export function rotateAds<T extends { id: string }>(ads: T[], limit: number, now = new Date()): T[] {
  if (ads.length <= limit) return ads;
  const start = rotationIndex(ads.map((a) => a.id).join('|'), ads.length, now);
  const ordered = [...ads.slice(start), ...ads.slice(0, start)];
  return ordered.slice(0, limit);
}
