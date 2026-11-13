import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, ShieldCheck, Store } from 'lucide-react';
import { site } from '../config/site';
import { featuredCategorySlugs, getCategory } from '../config/categories';
import { CategoryDirectory } from '../components/CategoryDirectory';
import { ListingGrid } from '../components/ListingGrid';
import { countActiveListings, fetchListings } from '../lib/api';
import { getRecentlyViewed, useSeo } from '../hooks';
import { websiteJsonLd } from '../lib/seo';
import type { BrowseFilters } from '../lib/types';
import './home-revamp.css';

const latestFilters: BrowseFilters = { q: '', cat: '', min: '', max: '', cond: '', loc: '', sort: 'new' };
const INITIAL_LISTINGS = 24;

export function HomePage() {
  const jsonLd = useMemo(() => websiteJsonLd(), []);
  useSeo({ title: 'Maua Soko in Maua Town, Meru', path: '/', description: site.description, jsonLd });

  const [showMore, setShowMore] = useState(false);
  const recentIds = getRecentlyViewed().slice(0, 2);

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
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="wrap home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-hero-kicker"><MapPin size={15} aria-hidden /> MAUA TOWN · MERU COUNTY · KENYA</span>
            <h1 id="home-hero-title">Find it in Maua.<br /><span>Sell it nearby.</span></h1>
            <p className="home-hero-description">
              Discover everyday finds, farm produce, property and local services from people in your community.
              Browse freely, compare listings and talk directly with sellers.
            </p>
            <div className="home-hero-actions home-hero-primary-actions">
              <Link to="/browse" className="btn btn-primary btn-large">Explore local listings <ArrowRight size={17} aria-hidden /></Link>
              <Link to="/categories" className="btn btn-quiet btn-large">Browse categories</Link>
            </div>
            <div className="home-hero-actions home-hero-secondary-actions">
              <Link to="/sell" className="btn btn-tag">Post a listing <ArrowRight size={16} aria-hidden /></Link>
              <span>Free to browse · No account needed to get started</span>
            </div>
          </div>

          <aside className="home-hero-aside" aria-label="How Maua Marketplace works">
            <div className="home-hero-aside-icon"><Store size={25} aria-hidden /></div>
            <p className="home-hero-aside-label">Your community noticeboard</p>
            <h2>Good finds are closer than you think.</h2>
            <div className="home-hero-points">
              <div><span className="home-hero-point-icon"><MapPin size={17} aria-hidden /></span><p><strong>Made for the neighbourhood</strong><span>Maua and nearby Meru communities</span></p></div>
              <div><span className="home-hero-point-icon"><ShieldCheck size={17} aria-hidden /></span><p><strong>Buy with care</strong><span>Practical safety tips on every step</span></p></div>
            </div>
            <Link to="/safety" className="home-hero-safety-link">Read our safety guide <ArrowRight size={15} aria-hidden /></Link>
          </aside>
        </div>
      </section>

      <section className="wrap home-quick-categories" aria-labelledby="quick-categories-title">
        <div className="home-section-heading">
          <div><span className="home-section-kicker">START EXPLORING</span><h2 id="quick-categories-title">What are you looking for?</h2></div>
          <Link to="/categories">All categories <ArrowRight size={15} aria-hidden /></Link>
        </div>
        <div className="home-category-shortcuts">
          {featuredCategorySlugs.map((slug) => {
            const category = getCategory(slug);
            const Icon = category.icon;
            return (
              <Link className="home-category-shortcut" to={`/category/${slug}`} key={slug}>
                <span><Icon size={21} aria-hidden /></span>
                <strong>{category.label}</strong>
                <ArrowRight size={15} aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap section home-listings" aria-labelledby="latest-title">
        <div className="section-head home-listings-head">
          <div className="home-heading-copy">
            <span className="home-section-kicker">FRESH FROM THE COMMUNITY</span>
            <h2 id="latest-title">Recently listed</h2>
            <p className="home-heading-note">See what's new from sellers around Maua and Meru County.</p>
            {typeof count.data === 'number' && count.data > 0 && (
              <p className="result-count">{count.data.toLocaleString('en-KE')} active listings</p>
            )}
          </div>
          <Link to="/browse" className="btn btn-quiet">Explore all listings <ArrowRight size={15} aria-hidden /></Link>
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
                <h3>The market is waiting for its first listing</h3>
                <p>Be the first to share something useful with the Maua community.</p>
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
              className="btn btn-quiet btn-large"
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
            <h2 id="recent-title">Pick up where you left off</h2>
            <Link to="/browse">Browse more</Link>
          </div>
          <ListingGrid listings={recent.data.slice(0, 2)} loading={false} empty={null} />
        </section>
      )}

      <section className="wrap section" aria-labelledby="cats-title">
        <div className="home-section-heading">
          <div><span className="home-section-kicker">A LITTLE BIT OF EVERYTHING</span><h2 id="cats-title">Browse all categories</h2></div>
          <Link to="/browse">See all listings <ArrowRight size={15} aria-hidden /></Link>
        </div>
        <CategoryDirectory />
      </section>

      <section className="wrap section home-intro" aria-labelledby="local-market-title">
        <span className="home-section-kicker">THE LOCAL MARKET, ONLINE</span>
        <h2 id="local-market-title">A simpler way to buy and sell around Maua</h2>
        <p>
          Maua Marketplace, also known as Maua Soko, connects people looking for everyday goods and local services
          with people offering them in Maua, Igembe and nearby parts of Meru County. Find phones and electronics,
          furniture, clothes, farm produce, livestock, vehicles, property, jobs and skilled services in one place.
        </p>
        <p>
          Listings are posted by community members. Review the photos, description, price and location, then contact
          the seller through the marketplace to ask questions and arrange an in-person inspection.
          <Link to="/categories"> Explore marketplace categories</Link> or <Link to="/browse">browse current listings</Link>.
        </p>
      </section>

      <section className="wrap section home-bottom">
        <div className="sell-band">
          <div>
            <span className="home-section-kicker">HAVE SOMETHING TO OFFER?</span>
            <h2>Put it in front of your community.</h2>
            <p>Add a few photos, set your price and connect with interested local buyers.</p>
          </div>
          <Link to="/sell" className="btn btn-tag btn-large">Post a listing <ArrowRight size={16} aria-hidden /></Link>
        </div>

        <aside className="home-safety" aria-labelledby="home-safety-title">
          <ShieldCheck aria-hidden />
          <div>
            <h2 id="home-safety-title">Keep every deal safe</h2>
            <p>
              Deals are directly between buyers and sellers. {site.name} does not verify members, hold money,
              inspect items or settle disputes.
            </p>
            <p><strong>Meet in a busy public place, inspect the item first, and never send money before you have seen it.</strong></p>
            <Link to="/safety">Read all safety tips <ArrowRight size={15} aria-hidden /></Link>
          </div>
        </aside>
      </section>
    </>
  );
}
