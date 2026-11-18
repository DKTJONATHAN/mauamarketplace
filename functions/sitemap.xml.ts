import { SITE_ORIGIN } from '../src/config/site-origin';

interface SitemapEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface PublicListing {
  id: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  location?: string | null;
  category?: string | null;
  images?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SitemapEntry {
  path: string;
  lastmod?: string;
  images?: string[];
}

const STATIC_PATHS = [
  '/',
  '/browse',
  '/advertise',
  '/categories',
  '/safety',
  '/rules',
  '/privacy',
  '/terms',
  '/refund-policy',
];

const PAGE_SIZE = 1000;
const MAX_LISTINGS = 50000;
const R2_MEDIA_BASE = 'https://pub-7ef5a8d013b245bfb993db42153b04e4.r2.dev';
const SUPABASE_MEDIA_BASE = 'https://akrbmcptyjjcjoyxaxkl.supabase.co/storage/v1/object/public/listing-images';

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function listingPath(listing: PublicListing): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(listing.id)) return `/listing/${encodeURIComponent(listing.id)}`;
  const slug = (listing.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');
  return `/listing/${slug || 'item'}-${listing.id}`;
}

function publicImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('r2/')) return `${R2_MEDIA_BASE}/${path.slice(3)}`;
  return `${SUPABASE_MEDIA_BASE}/${path.replace(/^\/+/, '')}`;
}

function lastModified(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function renderEntry(entry: SitemapEntry): string {
  const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
  const images = (entry.images || []).slice(0, 6).map((image) =>
    `\n    <image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>`,
  ).join('');
  return `  <url>\n    <loc>${xmlEscape(`${SITE_ORIGIN}${entry.path}`)}</loc>${lastmod}${images}\n  </url>`;
}

export async function onRequest({ env }: { env: SitemapEnv }): Promise<Response> {
  const entries = new Map<string, SitemapEntry>();
  for (const path of STATIC_PATHS) entries.set(path, { path });

  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  if (supabaseUrl && supabaseKey) {
    const categoryCounts = new Map<string, number>();
    for (let offset = 0; offset < MAX_LISTINGS; offset += PAGE_SIZE) {
      const params = new URLSearchParams({
        select: 'id,title,description,location,category,images,created_at,updated_at',
        status: 'eq.active',
        order: 'created_at.desc',
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/listings?${params.toString()}`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) break;
        const listings = await response.json() as PublicListing[];
        for (const listing of listings) {
          if (listing.category) categoryCounts.set(listing.category, (categoryCounts.get(listing.category) || 0) + 1);
          const hasUsefulDescription = Boolean(listing.description?.trim() && listing.description.trim().length >= 50);
          const hasLocation = Boolean(listing.location?.trim());
          if (listing.id && listing.title?.trim() && hasUsefulDescription && hasLocation) {
            const path = listingPath(listing);
            entries.set(path, {
              path,
              lastmod: lastModified(listing.updated_at || listing.created_at),
              images: (listing.images || []).filter(Boolean).map(publicImageUrl),
            });
          }
        }
        if (listings.length < PAGE_SIZE) break;
      } catch {
        break;
      }
    }

    for (const [category, count] of categoryCounts) {
      if (count >= 5 && /^[a-z0-9-]+$/i.test(category)) {
        const path = `/category/${category}`;
        entries.set(path, { path });
      }
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${[...entries.values()].map(renderEntry).join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-content-type-options': 'nosniff',
    },
  });
}
