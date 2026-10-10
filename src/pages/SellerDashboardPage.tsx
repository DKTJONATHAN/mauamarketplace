import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, MessageCircle, Package, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchMyListings } from '../lib/api';
import { useUnreadMessages, useDocumentTitle } from '../hooks';

export function SellerDashboardPage() {
  useDocumentTitle('Seller dashboard', true);
  const { user } = useAuth();
  const unread = useUnreadMessages();
  const query = useQuery({
    queryKey: ['seller-dashboard', user?.id],
    queryFn: () => fetchMyListings(user!.id),
    enabled: Boolean(user),
  });

  const listings = query.data ?? [];
  const active = listings.filter((l) => l.status === 'active').length;
  const sold = listings.filter((l) => l.status === 'sold').length;

  return (
    <div className="wrap page">
      <div className="section-head">
        <div><h1>Seller dashboard</h1><p className="muted">Manage your marketplace activity in one place.</p></div>
        <Link to="/sell" className="btn btn-primary"><PlusCircle aria-hidden /> Post a listing</Link>
      </div>

      {query.isLoading ? <p aria-busy="true">Loading your dashboard...</p> : (
        <>
          <div className="grid" style={{ marginBottom: '1.5rem' }}>
            <section className="panel"><Package aria-hidden /><h2>{active}</h2><p className="muted">Active listings</p></section>
            <section className="panel"><BarChart3 aria-hidden /><h2>{sold}</h2><p className="muted">Sold listings</p></section>
            <section className="panel"><MessageCircle aria-hidden /><h2>{unread}</h2><p className="muted">Unread messages</p></section>
          </div>
          <div className="actions">
            <Link to="/my-listings" className="btn btn-quiet">Manage listings</Link>
            <Link to="/messages" className="btn btn-quiet">Open messages</Link>
            <Link to="/account" className="btn btn-quiet">Account settings</Link>
          </div>
        </>
      )}
    </div>
  );
}
