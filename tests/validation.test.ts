import { describe, expect, it } from 'vitest';
import { emailSchema, listingSchema, normalizeKenyanPhone, passwordSchema } from '../src/lib/validation';

describe('normalizeKenyanPhone', () => {
  it('accepts common Kenyan formats', () => {
    expect(normalizeKenyanPhone('0712 345 678')).toBe('+254712345678');
    expect(normalizeKenyanPhone('+254-712-345-678')).toBe('+254712345678');
    expect(normalizeKenyanPhone('254112345678')).toBe('+254112345678');
    expect(normalizeKenyanPhone('0112345678')).toBe('+254112345678');
  });

  it('rejects anything else', () => {
    expect(normalizeKenyanPhone('12345')).toBeNull();
    expect(normalizeKenyanPhone('0612345678')).toBeNull();
    expect(normalizeKenyanPhone('+1 415 555 0100')).toBeNull();
    expect(normalizeKenyanPhone('07123456789')).toBeNull();
  });
});

describe('auth schemas', () => {
  it('normalises and validates email', () => {
    expect(emailSchema.parse('  Jane@Example.COM ')).toBe('jane@example.com');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('enforces password length', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('long enough password').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false);
  });
});

describe('listingSchema', () => {
  const valid = {
    title: 'Samsung 43 inch smart TV',
    category: 'tvs-audio',
    description: 'Works perfectly, comes with the remote and wall bracket.',
    price: 32000,
    negotiable: true,
    condition: 'good' as const,
    location: 'Maua Town',
  };

  it('accepts a good listing', () => {
    expect(listingSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown categories, short text and bad prices', () => {
    expect(listingSchema.safeParse({ ...valid, category: 'nope' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, title: 'TV' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, description: 'too short' }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, price: -5 }).success).toBe(false);
    expect(listingSchema.safeParse({ ...valid, price: 12.5 }).success).toBe(false);
  });

  it('allows an unpriced listing (services, jobs, wanted)', () => {
    expect(listingSchema.safeParse({ ...valid, price: null }).success).toBe(true);
  });
});
