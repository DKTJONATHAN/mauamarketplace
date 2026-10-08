import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { ListingGrid } from '../components/ListingGrid';
import { ReportDialog } from '../components/ReportDialog';
import { useAuth } from '../context/AuthContext';
import { fetchPublicProfile, fetchSellerListings } from '../lib/api';
import { isNewMember, memberSince } from '../lib/format';
import { useSeo, useGoToLogin } from '../hooks';
import { site } from '../config/site';

export function SellerPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const goToLogin = useGoToLogin();
  const [reporting, setReporting] = useState(false);

  const profile = useQuery({ queryKey: ['profile', id], queryFn: () => fetchPublicProfile(id) });
  const listings = useQuery({ queryKey: ['seller-listings', id], queryFn: () => fetchSellerListings(id) });
  useSeo({
    title: profile.data?.display_name,
    description: profile.data?.display_name
      ? `Listings from ${profile.data.display_name} on ${site.name} in ${site.place}.`
      : `Seller profile on ${site.name}.`,
    path: id ? `/seller/${id}` : '/seller',
  });

  if (profile.isLoading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (!profile.data) {
    return (
      <div className="wrap page narrow">
        <h1>Member not found</h1>
        <p><Link to="/browse">Browse listings</Link></p>
      </div>
    );
  }

  const p = profile.data;
  return (
    <div className="wrap page">
      <header className="seller-head">
        <div>
          <h1>{p.display_name}</h1>
          <p className="muted">
            Member since {memberSince(p.created_at)}
            {isNewMember(p.created_at) && <span className="chip chip-warn">New member</span>}
          </p>
        </div>
        {user?.id !== p.id && (
          <button type="button" className="btn btn-quiet" onClick={() => (user ? setReporting(true) : goToLogin())}>
            <Flag aria-hidden /> Report member
          </button>
        )}
      </header>
      <h2>Listings</h2>
      <ListingGrid listings={listings.data} loading={listings.isLoading} empty={<p>This member has no live listings.</p>} />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={p.id} subject={p.display_name} />
    </div>
  );
}
