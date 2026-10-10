interface SitemapEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface PublicListing {
  id: string;
  created_at?: string | null;
}

const ORIGIN = 'https://mauamarketplace.pages.dev';
const CATEGORY_SLUGS = ["phones","phone-accessories","computers","computer-accessories","tvs-audio","cameras","gaming","solar-power","furniture","appliances","kitchenware","beds-bedding","decor","building-materials","tools","clothing-women","clothing-men","clothing-kids","shoes","bags","jewellery-watches","baby","cars","motorbikes","trucks-vans","bicycles","vehicle-parts","school-items","books","farm-produce","livestock","farm-machinery","farm-inputs","pets","property-rent","property-sale","commercial-property","house-help","jobs","services","construction","cleaning","events","beauty","business-equipment","health-fitness","sports","music","art-crafts","free","wanted","other"];

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function urlEntry(path: string, priority = '0.5', lastmod?: string): string {
  const date = lastmod && Number.isFinite(Date.parse(lastmod)) ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n` : '';
  return `  <url>\n    <loc>${xmlEscape(`${ORIGIN}${path}`)}</loc>\n${date}    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function onRequest({ env }: { env: SitemapEnv }): Promise<Response> {
  const entries = [
    urlEntry('/', '1.0'),
    urlEntry('/categories', '0.6'),
    urlEntry('/browse', '0.6'),
    urlEntry('/safety', '0.3'),
    urlEntry('/rules', '0.3'),
    urlEntry('/privacy', '0.2'),
    urlEntry('/terms', '0.2'),
    ...CATEGORY_SLUGS.map((slug: string) => urlEntry(`/category/${slug}`, '0.8')),
  ];

  let supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  while (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  if (supabaseUrl && supabaseKey) {
    try {
      const params = new URLSearchParams({
        select: 'id,created_at',
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
        for (const listing of listings) {
          if (listing.id && /^[a-zA-Z0-9-]+$/.test(listing.id)) {
            entries.push(urlEntry(`/listing/${listing.id}`, '0.7', listing.created_at ?? undefined));
          }
        }
      }
    } catch {
      // The static page and category URLs remain available if the listing API is temporarily unavailable.
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-content-type-options': 'nosniff',
    },
  });
}
