import { env } from '../lib/env';

/** Site-wide configuration and SEO defaults. */
export const site = {
  name: 'Maua Marketplace',
  shortName: 'Maua Market',
  place: 'Maua',
  region: 'Meru County',
  country: 'Kenya',
  locations: ['Maua Town', 'Laare', 'Kangeta', 'Muthara', 'Mikinduri', 'Nkubu', 'Meru Town'],
  contactEmail: '',
  listingLifetimeDays: 60,
  maxImages: 6,
  /** Default meta description (keep under ~160 chars for Google). */
  description:
    'Buy and sell phones, farm produce, furniture, cars and more with people in Maua, Meru County. Free to post. Talk to sellers in the app.',
  /** Short description for social cards. */
  socialDescription: 'Buy and sell with people in Maua, Meru County. Free classifieds — phones, produce, cars, services and more.',
  /** Locale for Open Graph / HTML. */
  locale: 'en_KE',
  language: 'en',
  themeColor: '#0a4a31',
  /** Production origin + base path (no trailing slash on origin). Used for absolute URLs in meta tags. */
  productionOrigin: 'https://dktjonathan.github.io',
  /** Twitter / X handle if you create one later (e.g. @mauamarket). Leave empty to omit. */
  twitterHandle: '',
} as const;

export const mediaBaseUrl = env.supabaseUrl ? `${env.supabaseUrl}/storage/v1/object/public/listing-images` : '';

export function mediaUrl(path: string): string {
  return `${mediaBaseUrl}/${path}`;
}

/**
 * Absolute site root including Vite base path, always with a trailing slash.
 * Safe in the browser; falls back to the known GitHub Pages URL during SSR-less builds.
 */
export function siteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = import.meta.env.BASE_URL || '/';
    const origin = window.location.origin;
    return `${origin}${base.endsWith('/') ? base : `${base}/`}`;
  }
  const base = import.meta.env.BASE_URL || '/mauamarketplace/';
  return `${site.productionOrigin}${base.endsWith('/') ? base : `${base}/`}`;
}

/** Absolute URL for a hash-router path (e.g. path = "/listing/abc"). */
export function absoluteUrl(path = '/'): string {
  const root = siteUrl();
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return root;
  // HashRouter: public shareable links use #/path
  return `${root}#${clean}`;
}

/** Default Open Graph image (logo). Prefer a dedicated 1200×630 asset when available. */
export function defaultOgImage(): string {
  return `${siteUrl()}logo.png`;
}
