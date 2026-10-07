import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { categoryGroups } from '../config/categories';
import { site } from '../config/site';
import { CategoryDirectory } from '../components/CategoryDirectory';
import { ListingGrid } from '../components/ListingGrid';
import { countActiveListings, fetchListings } from '../lib/api';
import { getRecentlyViewed, useDocumentTitle } from '../hooks';
import type { BrowseFilters } from '../lib/types';

const latestFilters: BrowseFilters = { q: '', cat: '', min: '', max: '', cond: '', loc: '', sort: 'new' };

export function HomePage() {
  useDocumentTitle();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  const latest = useQuery({ queryKey: ['latest'], queryFn: () => fetchListings(latestFilters, 0) });
  const recentIds = getRecentlyViewed();
  const recent = useQuery({ queryKey: ['recent-listings', recentIds.join(',')], queryFn: () => import('../lib/api').then(({ fetchListingsByIds }) => fetchListingsByIds(recentIds)), enabled: recentIds.length > 0 });
  const count = useQuery({ queryKey: ['active-count'], queryFn: countActiveListings, staleTime: 120_000 });

  function search(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (cat) params.set('cat', cat);
    navigate(`/browse${params.size ? `?${params}` : ''}`);
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>
              Buy and sell
              <br />
              in {site.place}.
            </h1>
            <p className="hero-lead">
              Phones, farm produce, furniture, cars, house helps and more, posted by people nearby. Free to list. Talk to
              sellers inside the app and keep your number to yourself until you choose to share it.
            </p>
            <form className="hero-search" role="search" onSubmit={search}>
              <label className="sr-only" htmlFor="hero-q">What are you looking for?</label>
              <input
                id="hero-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What are you looking for?"
                maxLength={60}
              />
              <label className="sr-only" htmlFor="hero-cat">Category</label>
              <select id="hero-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">All categories</option>
                {categoryGroups.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.items.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button type="submit" className="btn btn-primary">
                <Search aria-hidden /> Search
              </button>
            </form>
            {typeof count.data === 'number' && count.data > 0 && (
              <p className="hero-count">{count.data.toLocaleString('en-KE')} listings live right now</p>
            )}
          </div>

          <aside className="steps-card" aria-labelledby="steps-title">
            <h2 id="steps-title">A safe deal, step by step</h2>
            <ol>
              <li>
                <strong>Message in the app.</strong> Ask questions and agree a time. Share your phone number only if you want to.
              </li>
              <li>
                <strong>Meet in a busy public place.</strong> Daytime, near other people. Bring a friend for big purchases.
              </li>
              <li>
                <strong>Inspect, then pay.</strong> Test the item first. Never send money before you have seen it.
              </li>
            </ol>
            <Link to="/safety">More safety tips</Link>
          </aside>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="latest-title">
        <div className="section-head">
          <h2 id="latest-title">Fresh in {site.place}</h2>
          <Link to="/browse">See everything</Link>
        </div>
        <ListingGrid
          listings={latest.data?.items.slice(0, 12)}
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

      <section className="wrap section">
        <div className="sell-band">
          <div>
            <h2>Got something to sell?</h2>
            <p>Add photos, set a price and go live. Buyers contact you through the app.</p>
          </div>
          <Link to="/sell" className="btn btn-tag btn-large">Post a listing</Link>
        </div>
      </section>
    </>
  );
}
