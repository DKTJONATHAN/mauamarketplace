import { z } from 'zod';
import { site } from '../config/site';
import { isValidCategory } from '../config/categories';

/** Normalises 07xx / 01xx / +254... / 254... numbers to +254XXXXXXXXX, or returns null. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let national: string;
  if (/^\+254[17]\d{8}$/.test(digits)) national = digits.slice(4);
  else if (/^254[17]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0[17]\d{8}$/.test(digits)) national = digits.slice(1);
  else return null;
  return `+254${national}`;
}

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(40, 'Use 40 characters or fewer.');

export const listingSchema = z.object({
  title: z.string().trim().min(5, 'Give the listing a title of at least 5 characters.').max(100, 'Keep the title under 100 characters.'),
  category: z.string().refine(isValidCategory, 'Choose a category.'),
  description: z.string().trim().min(20, 'Describe the item in at least 20 characters.').max(2000, 'Keep the description under 2000 characters.'),
  price: z.number().int('Use a whole number.').min(0, 'Price cannot be negative.').max(1_000_000_000, 'That price is too high.').nullable(),
  negotiable: z.boolean(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'for_parts']).nullable(),
  location: z.string().trim().min(2, 'Enter where the item is.').max(60, 'Keep the location under 60 characters.'),
});

export type ListingInput = z.infer<typeof listingSchema>;

export const messageSchema = z.string().trim().min(1).max(2000);

export const maxImages = site.maxImages;
