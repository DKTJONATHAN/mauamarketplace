import { describe, expect, it } from 'vitest';
import { cleanSearchTerm } from '../src/lib/api';
import { daysLeft, formatPrice, isNewMember, timeAgo } from '../src/lib/format';

describe('formatPrice', () => {
  it('formats shillings, free and unpriced', () => {
    expect(formatPrice(32000)).toBe('KSh 32,000');
    expect(formatPrice(15000, '/month')).toBe('KSh 15,000/month');
    expect(formatPrice(0)).toBe('Free');
    expect(formatPrice(null)).toBe('Price on request');
  });
});

describe('time helpers', () => {
  const now = new Date('2026-10-07T12:00:00Z').getTime();
  it('describes recent times', () => {
    expect(timeAgo('2026-10-07T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-07T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-04T12:00:00Z', now)).toBe('3 days ago');
  });
  it('flags members who joined in the last two weeks', () => {
    expect(isNewMember('2026-10-01T00:00:00Z', now)).toBe(true);
    expect(isNewMember('2026-08-01T00:00:00Z', now)).toBe(false);
  });
  it('counts days left', () => {
    expect(daysLeft('2026-10-17T12:00:00Z', now)).toBe(10);
  });
});

describe('cleanSearchTerm', () => {
  it('strips characters that would break a PostgREST filter', () => {
    expect(cleanSearchTerm('iphone, (12) 100%')).toBe('iphone 12 100');
    expect(cleanSearchTerm("  a'b\"c*d_e  ")).toBe('a b c d e');
  });
});
