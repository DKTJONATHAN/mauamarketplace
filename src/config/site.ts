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
  maxImages: 6,
  /** Default meta description (keep under ~160 chars for Google). */
  description:
    'Maua Soko is the online marketplace for Maua town and Meru County, Kenya. Buy and sell new and second-hand items from local sellers.',
  /** Short description for social cards. */
  socialDescription: 'Shop and sell on Maua Soko, Maua town’s online marketplace in Meru County. Find new and second-hand items from local sellers.',
  /** Locale for Open Graph / HTML. */
  locale: 'en_KE',
  language: 'en',
  themeColor: '#0a4a31',
  /** Production origin (no trailing slash). Used for absolute URLs in meta tags when window is unavailable. */
  productionOrigin: 'https://mauamarketplace.eu.cc',
  /** Twitter / X handle if you create one later (e.g. @mauamarket). Leave empty to omit. */
  twitterHandle: '',
} as const;

export const mediaBaseUrl = (import.meta.env.VITE_R2_MEDIA_BASE_URL ?? 'https://pub-7ef5a8d013b245bfb993db42153b04e4.r2.dev').replace(/\/$/, '');

export function mediaUrl(path: string): string {
  if (path.startsWith('r2/')) return `${mediaBaseUrl}/${path.slice(3)}`;
  // During migration, old images continue to load from Supabase Storage.
  return env.supabaseUrl ? `${env.supabaseUrl}/storage/v1/object/public/listing-images/${path}` : path;
}

/**
 * Absolute site root including Vite base path, always with a trailing slash.
 * Safe in the browser; falls back to the known production URL during SSR-less builds.
 */
export function siteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = import.meta.env.BASE_URL || '/';
    const origin = window.location.origin;
    return `${origin}${base.endsWith('/') ? base : `${base}/`}`;
  }
  const base = import.meta.env.BASE_URL || '/';
  return `${site.productionOrigin}${base.endsWith('/') ? base : `${base}/`}`;
}

/** Absolute URL for a clean browser-router path (e.g. path = "/listing/abc"). */
export function absoluteUrl(path = '/'): string {
  const root = siteUrl();
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return root;
  return clean === '/' ? root : `${root}${clean.slice(1)}`;
}

/** Default Open Graph image (logo). Prefer a dedicated 1200×630 asset when available. */
export function defaultOgImage(): string {
  return `${siteUrl()}logo.png`;
}
