import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListingGrid } from '../components/ListingGrid';
import { fetchListingsByIds, fetchSavedListings } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle, useGoToLogin, useSaved } from '../hooks';

export function SavedPage() {
  useDocumentTitle('Saved', true);
  const { user, loading, isAnonymous } = useAuth();
  const { ids } = useSaved();
  const goToLogin = useGoToLogin();
  const query = useQuery({ queryKey: ['saved-listings', user?.id, isAnonymous ? [...ids].join(',') : 'account'], queryFn: () => isAnonymous ? fetchListingsByIds([...ids]) : fetchSavedListings(), enabled: Boolean(user) });

  if (!loading && !user) {
    return (
      <div className="wrap page narrow">
        <h1>Saved listings</h1>
        <p>You can browse and save favourites as a guest. Log in only when you want to contact a seller or sell something.</p>
        <button type="button" className="btn btn-primary" onClick={goToLogin}>Log in</button>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <h1>Saved listings</h1>
      <ListingGrid
        listings={query.data}
        loading={query.isLoading}
        empty={
          <>
            <h3>Nothing saved yet</h3>
            <p>Tap the heart on any listing to keep it here.</p>
            <Link to="/browse" className="btn btn-primary">Browse listings</Link>
          </>
        }
      />
    </div>
  );
}
