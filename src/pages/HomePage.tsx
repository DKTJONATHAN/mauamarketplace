import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { site } from '../config/site';
import { CategoryDirectory } from '../components/CategoryDirectory';
import { CategoryShortcuts } from '../components/CategoryShortcuts';
import { ListingGrid } from '../components/ListingGrid';
import { countActiveListings, fetchListings } from '../lib/api';
import { getRecentlyViewed, useSeo } from '../hooks';
import { websiteJsonLd } from '../lib/seo';
import type { BrowseFilters } from '../lib/types';

const latestFilters: BrowseFilters = { q: '', cat: '', min: '', max: '', cond: '', loc: '', sort: 'new' };
const INITIAL_LISTINGS = 24;

export function HomePage() {
  const jsonLd = useMemo(() => websiteJsonLd(), []);
  useSeo({ path: '/', description: site.description, jsonLd });

  const [showMore, setShowMore] = useState(false);
  const recentIds = getRecentlyViewed();

  const latest = useQuery({
    queryKey: ['latest'],
    queryFn: () => fetchListings(latestFilters, 0),
  });

  const more = useQuery({
    queryKey: ['latest-more'],
    queryFn: () => fetchListings(latestFilters, 1),
    enabled: showMore,
  });

  const recent = useQuery({
    queryKey: ['recent-listings', recentIds.join(',')],
    queryFn: () => import('../lib/api').then(({ fetchListingsByIds }) => fetchListingsByIds(recentIds)),
    enabled: recentIds.length > 0,
  });

  const count = useQuery({
    queryKey: ['active-count'],
    queryFn: countActiveListings,
    staleTime: 120_000,
  });

  const firstListings = latest.data?.items ?? [];
  const moreListings = more.data?.items ?? [];
  const listings = showMore ? [...firstListings, ...moreListings] : firstListings.slice(0, INITIAL_LISTINGS);
  const hasMore = showMore
    ? Boolean(more.data?.hasMore)
    : Boolean(latest.data?.hasMore || firstListings.length > INITIAL_LISTINGS);

  return (
    <>
      <CategoryShortcuts />

      <section className="wrap section home-listings" aria-labelledby="latest-title">
        <div className="section-head home-listings-head">
          <div>
            <h1 id="latest-title">Fresh listings in {site.place}</h1>
            {typeof count.data === 'number' && count.data > 0 && (
              <p className="result-count">{count.data.toLocaleString('en-KE')} listings live right now</p>
            )}
          </div>
          <Link to="/browse" className="btn btn-quiet">Browse &amp; filter</Link>
        </div>

        <ListingGrid
          listings={listings}
          loading={latest.isLoading}
          empty={
            latest.isError ? (
              <>
                <h3>Listings could not load</h3>
                <p>Check your connection and refresh the page.</p>
              </>
            ) : (
              <>
                <h3>Nothing posted yet</h3>
                <p>Be the first to list something for sale in {site.place}. It takes about two minutes.</p>
                <Link to="/sell" className="btn btn-primary">Post a listing</Link>
              </>
            )
          }
        />

        {!latest.isLoading && latest.data && (hasMore || showMore) && (
          <div className="listing-more">
            {more.isError && showMore && (
              <p className="field-error" role="alert">More listings could not load. Please try again.</p>
            )}
            <button
              type="button"
              className="btn btn-tag btn-large"
              onClick={() => setShowMore((value) => !value)}
              disabled={more.isFetching}
              aria-expanded={showMore}
            >
              {more.isFetching ? 'Loading more listings...' : showMore ? 'Show fewer listings' : 'Show more listings'}
            </button>
          </div>
        )}
      </section>

      {recent.data && recent.data.length > 0 && (
        <section className="wrap section" aria-labelledby="recent-title">
          <div className="section-head">
            <h2 id="recent-title">Recently viewed</h2>
            <Link to="/browse">Browse more</Link>
          </div>
          <ListingGrid listings={recent.data.slice(0, 6)} loading={false} empty={null} />
        </section>
      )}

      <section className="wrap section" aria-labelledby="cats-title">
        <div className="section-head">
          <h2 id="cats-title">Browse by category</h2>
        </div>
        <CategoryDirectory />
      </section>

      <section className="wrap section home-intro" aria-labelledby="local-market-title">
        <h2 id="local-market-title">Maua’s local online market for new and second-hand items</h2>
        <p>
          Looking for a market in Maua town? {site.name} helps buyers and sellers across Maua, Igembe and
          nearby parts of {site.region}, Kenya, find each other online. Browse new products and second-hand
          bargains, compare prices, and discover items listed by people in your community.
        </p>
        <p>
          Find phones and electronics, sofas and furniture, clothes and shoes, household goods, farm produce,
          tools, vehicles, property and local services. You can also post an item for sale and connect directly
          with interested buyers. Listings are free to browse, and sellers and buyers should meet safely and
          inspect goods before making payment.
        </p>
        <p><Link to="/categories">Explore all Maua Marketplace categories</Link> or <Link to="/browse">browse every listing</Link>.</p>
      </section>

      <section className="wrap section home-bottom">
        <div className="sell-band">
          <div>
            <h2>Got something to sell?</h2>
            <p>Add photos, set a price and go live. Buyers contact you through the app.</p>
          </div>
          <Link to="/sell" className="btn btn-tag btn-large">Post a listing</Link>
        </div>

        <aside className="home-safety" aria-labelledby="home-safety-title">
          <ShieldCheck aria-hidden />
          <div>
            <h2 id="home-safety-title">Stay safe when buying or selling</h2>
            <p>
              Deals are directly between you and the other person. {site.name} does not verify sellers, hold money,
              inspect items or settle disputes.
            </p>
            <p>
              <strong>Meet in a busy public place, inspect the item first, and never send money before you have seen it.</strong>
            </p>
            <Link to="/safety">Read all safety tips</Link>
          </div>
        </aside>
      </section>
    </>
  );
}
