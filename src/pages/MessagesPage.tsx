import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { ListingImage } from '../components/ListingImage';
import { useAuth } from '../context/AuthContext';
import { fetchConversations } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useDocumentTitle, useGoToLogin } from '../hooks';

export function MessagesPage() {
  useDocumentTitle('Messages', true);
  const { user, loading } = useAuth();
  const goToLogin = useGoToLogin();
  const query = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: fetchConversations,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  if (!loading && !user) {
    return (
      <div className="wrap page narrow">
        <h1>Messages</h1>
        <p>Log in to message sellers and buyers without sharing your phone number.</p>
        <button type="button" className="btn btn-primary" onClick={goToLogin}>Log in</button>
      </div>
    );
  }

  return (
    <div className="wrap page narrow">
      <h1>Messages</h1>
      {query.isLoading && <p aria-busy="true">Loading...</p>}
      {query.isError && <p role="alert">{(query.error as Error).message}</p>}
      {query.data && query.data.length === 0 && (
        <div className="empty">
          <MessageCircle aria-hidden />
          <h3>No conversations yet</h3>
          <p>Open a listing and tap "Message seller" to start one.</p>
          <Link to="/browse" className="btn btn-primary">Browse listings</Link>
        </div>
      )}
      <ul className="convo-list">
        {query.data?.map((c) => (
          <li key={c.id}>
            <Link to={`/messages/${c.id}`} className={c.unread > 0 ? 'convo is-unread' : 'convo'}>
              <span className="convo-thumb">
                <ListingImage path={c.listing_image ?? undefined} category="other" alt="" />
              </span>
              <span className="convo-text">
                <span className="convo-top">
                  <strong>{c.other_name}</strong>
                  <time dateTime={c.last_at}>{timeAgo(c.last_at)}</time>
                </span>
                <span className="convo-title">{c.listing_title}</span>
                <span className="convo-preview">{c.last_body ?? 'No messages yet'}</span>
              </span>
              {c.unread > 0 && <span className="badge" aria-label={`${c.unread} unread`}>{c.unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
