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
}

const STATIC_PATHS = [
  '/',
  '/categories',
  '/safety',
  '/rules',
  '/privacy',
  '/terms',
  '/refund-policy',
];

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function urlEntry(path: string): string {
  return `  <url>\n    <loc>${xmlEscape(`${SITE_ORIGIN}${path}`)}</loc>\n  </url>`;
}

function listingPath(listing: PublicListing): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(listing.id)) return `/listing/${encodeURIComponent(listing.id)}`;
  const slug = (listing.title || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');
  return `/listing/${slug || 'item'}-${listing.id}`;
}

export async function onRequest({ env }: { env: SitemapEnv }): Promise<Response> {
  const paths = new Set(STATIC_PATHS);
  let supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  while (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseKey) {
    try {
      const params = new URLSearchParams({
        select: 'id,title,description,price,location,category,images',
        status: 'eq.active',
        order: 'created_at.desc',
        limit: '5000',
      });
      const response = await fetch(`${supabaseUrl}/rest/v1/listings?${params.toString()}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      });
      if (response.ok) {
        const listings = await response.json() as PublicListing[];
        const categoryCounts = new Map<string, number>();
        for (const listing of listings) {
          if (listing.category) categoryCounts.set(listing.category, (categoryCounts.get(listing.category) || 0) + 1);
          const hasUsefulDescription = Boolean(listing.description?.trim() && listing.description.trim().length >= 80);
          const hasPrice = typeof listing.price === 'number' && Number.isFinite(listing.price) && listing.price > 0;
          const hasImage = Array.isArray(listing.images) && listing.images.length > 0;
          const hasLocation = Boolean(listing.location?.trim());
          if (listing.id && listing.title?.trim() && hasUsefulDescription && hasPrice && hasImage && hasLocation) {
            paths.add(listingPath(listing));
          }
        }
        for (const [category, count] of categoryCounts) {
          if (count >= 5 && /^[a-z0-9-]+$/i.test(category)) paths.add(`/category/${category}`);
        }
      }
    } catch {
      // Keep the real static public pages available if Supabase is temporarily unavailable.
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths].map(urlEntry).join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-content-type-options': 'nosniff',
    },
  });
}
