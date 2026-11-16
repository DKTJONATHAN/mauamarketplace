import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './ad-slot.css';

type AdPlacement = 'homepage_banner' | 'category_feature' | 'business_spotlight';
interface Advertisement {
  id: string;
  business_name: string;
  headline: string | null;
  body: string | null;
  website_url: string | null;
  creative_url: string | null;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function AdSlot({ placement }: { placement: AdPlacement }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  const query = useQuery({
    queryKey: ['marketplace-advertisements', placement, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select('id,business_name,headline,body,website_url,creative_url')
        .eq('placement', placement)
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw new Error(error.message || 'Could not load sponsored placements.');
      return (data ?? []) as Advertisement[];
    },
    staleTime: 60_000,
    retry: false,
  });

  if (query.isLoading) return null;
  const ads = query.data ?? [];
  const label = placement === 'homepage_banner' ? 'Homepage advertising' :
    placement === 'category_feature' ? 'Category advertising' : 'Business spotlight';

  return (
    <section className={`marketplace-ad-slot marketplace-ad-slot-${placement}`} aria-label={label}>
      {ads.length ? (
        <div className="marketplace-ad-grid">
          {ads.map((ad) => {
            const website = safeExternalUrl(ad.website_url);
            const creative = safeExternalUrl(ad.creative_url);
            return (
              <article className="marketplace-ad" key={ad.id}>
                {creative && <img src={creative} alt="" loading="lazy" />}
                <div className="marketplace-ad-copy">
                  <span className="marketplace-ad-label">Sponsored</span>
                  <h2>{ad.headline || ad.business_name}</h2>
                  {ad.body && <p>{ad.body}</p>}
                  {website && <a href={website} target="_blank" rel="noopener noreferrer">Visit business <span aria-hidden>↗</span></a>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="marketplace-ad-empty">
          <div>
            <span className="marketplace-ad-label">Advertising space</span>
            <strong>Your business could appear here.</strong>
            <p>Reach people exploring products and services around Maua.</p>
          </div>
          <Link to="/advertise">View rates and book a slot <span aria-hidden>→</span></Link>
        </div>
      )}
    </section>
  );
}
