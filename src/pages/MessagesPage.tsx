import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Search, SlidersHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ListingImage } from '../components/ListingImage';
import { useAuth } from '../context/AuthContext';
import { fetchConversations } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useDocumentTitle, useGoToLogin } from '../hooks';

export function MessagesPage() {
  useDocumentTitle('Messages', true);
  const { user, loading } = useAuth();
  const goToLogin = useGoToLogin();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: fetchConversations,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const conversations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter((conversation) => {
      if (unreadOnly && conversation.unread === 0) return false;
      if (!term) return true;
      return `${conversation.other_name} ${conversation.listing_title} ${conversation.last_body ?? ''}`.toLocaleLowerCase().includes(term);
    });
  }, [query.data, search, unreadOnly]);
  const unreadTotal = query.data?.reduce((sum, conversation) => sum + conversation.unread, 0) ?? 0;

  if (!loading && !user) {
    return (
      <div className="wrap page narrow">
        <div className="inbox-login-card">
          <span className="inbox-hero-icon"><MessageCircle aria-hidden /></span>
          <h1>Your conversations, all in one place</h1>
          <p>Log in to message buyers and sellers, share photos of items, and keep your deal details together without sharing your phone number.</p>
          <button type="button" className="btn btn-primary" onClick={goToLogin}>Log in to messages</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap page inbox-page">
      <header className="inbox-heading">
        <div>
          <span className="inbox-eyebrow">MAUA MARKETPLACE</span>
          <h1>Messages <span className="inbox-count">{query.data?.length ?? 0}</span></h1>
          <p>Keep your buying and selling conversations moving.</p>
        </div>
        {unreadTotal > 0 && <div className="inbox-unread-summary"><span className="inbox-unread-dot" />{unreadTotal} unread {unreadTotal === 1 ? 'message' : 'messages'}</div>}
      </header>

      <section className="inbox-panel" aria-label="Your conversations">
        <div className="inbox-toolbar">
          <label className="inbox-search">
            <Search aria-hidden />
            <span className="sr-only">Search conversations</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people or listings…" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}
          </label>
          <button type="button" className={unreadOnly ? 'inbox-filter is-active' : 'inbox-filter'} onClick={() => setUnreadOnly((value) => !value)} aria-pressed={unreadOnly}>
            <SlidersHorizontal aria-hidden /><span>Unread</span>
          </button>
        </div>

        {query.isLoading && <div className="inbox-state" aria-busy="true"><span className="inbox-spinner" />Loading your conversations…</div>}
        {query.isError && <div className="inbox-state inbox-error" role="alert"><strong>Messages could not load</strong><p>{(query.error as Error).message}</p><button type="button" className="btn btn-quiet" onClick={() => void query.refetch()}>Try again</button></div>}
        {!query.isLoading && !query.isError && (query.data?.length ?? 0) === 0 && (
          <div className="inbox-state inbox-empty">
            <span className="inbox-hero-icon"><MessageCircle aria-hidden /></span>
            <h2>No conversations yet</h2>
            <p>When you message a seller or a buyer, your chat will appear here.</p>
            <Link to="/browse" className="btn btn-primary">Browse listings</Link>
          </div>
        )}
        {!query.isLoading && !query.isError && query.data && query.data.length > 0 && conversations.length === 0 && (
          <div className="inbox-state"><strong>No matching conversations</strong><p>Try a different search or turn off the unread filter.</p><button type="button" className="btn btn-quiet" onClick={() => { setSearch(''); setUnreadOnly(false); }}>Clear filters</button></div>
        )}
        {conversations.length > 0 && (
          <ul className="inbox-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link to={`/messages/${c.id}`} className={c.unread > 0 ? 'inbox-conversation is-unread' : 'inbox-conversation'}>
                  <span className="inbox-listing-photo"><ListingImage path={c.listing_image ?? undefined} category="other" alt="" /></span>
                  <span className="inbox-person-avatar" aria-hidden>{c.other_name.trim().charAt(0).toUpperCase() || 'M'}</span>
                  <span className="inbox-conversation-copy">
                    <span className="inbox-conversation-top"><strong>{c.other_name}</strong><time dateTime={c.last_at}>{timeAgo(c.last_at)}</time></span>
                    <span className="inbox-listing-title">{c.listing_title}</span>
                    <span className="inbox-preview">{c.last_body === '📷 Photo' ? '📷 Photo' : c.last_body ?? 'Start the conversation'}</span>
                  </span>
                  <span className="inbox-conversation-end">{c.unread > 0 && <span className="inbox-unread-badge" aria-label={`${c.unread} unread messages`}>{c.unread > 99 ? '99+' : c.unread}</span>}<span className="inbox-chevron" aria-hidden>›</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="inbox-safety-note"><span aria-hidden>🛡️</span> Keep conversations here, meet in public, inspect items before paying, and never share your M-Pesa PIN.</p>
    </div>
  );
}
