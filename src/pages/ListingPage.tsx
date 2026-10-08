import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock, Copy, Flag, MapPin, MessageCircle, Phone, Share2, TriangleAlert } from 'lucide-react';
import { getCategory } from '../config/categories';
import { Dialog } from '../components/Dialog';
import { Gallery } from '../components/Gallery';
import { OwnerActions } from '../components/OwnerActions';
import { ReportDialog } from '../components/ReportDialog';
import { SafetyPanel } from '../components/SafetyPanel';
import { SaveButton } from '../components/SaveButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultNotice } from '../config/categories';
import { fetchContactPhone, fetchListing, startConversation } from '../lib/api';
import { formatPrice, isNewMember, memberSince, timeAgo } from '../lib/format';
import { conditionLabels } from '../lib/types';
import { rememberRecentlyViewed, useSeo, useGoToLogin } from '../hooks';
import { listingDescription, listingJsonLd } from '../lib/seo';
import { mediaUrl } from '../config/site';

export function ListingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAnonymous } = useAuth();
  const goToLogin = useGoToLogin();
  const [reporting, setReporting] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'closed' | 'warn' | 'shown'>('closed');

  const query = useQuery({ queryKey: ['listing', id], queryFn: () => fetchListing(id) });
  const listing = query.data;
  useEffect(() => { if (listing?.id) rememberRecentlyViewed(listing.id); }, [listing?.id]);
  useSeo(
    listing
      ? {
          title: listing.title,
          description: listingDescription(listing),
          path: `/listing/${listing.id}`,
          image: listing.images?.[0] ? mediaUrl(listing.images[0]) : undefined,
          type: 'product',
          jsonLd: listingJsonLd(listing),
        }
      : { title: 'Listing', path: `/listing/${id}`, noindex: true },
  );

  const message = useMutation({
    mutationFn: () => startConversation(id),
    onSuccess: (conversationId) => navigate(`/messages/${conversationId}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const phone = useQuery({
    queryKey: ['phone', id, user?.id],
    queryFn: () => fetchContactPhone(id),
    enabled: phoneStep === 'shown' && Boolean(user),
  });

  if (query.isLoading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (query.isError) {
    return (
      <div className="wrap page narrow">
        <h1>Listing could not load</h1>
        <p>{(query.error as Error).message}</p>
        <button type="button" className="btn btn-primary" onClick={() => void query.refetch()}>Try again</button>
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="wrap page narrow">
        <h1>Listing not found</h1>
        <p>It may have been deleted, or hidden after reports from other members.</p>
        <Link to="/browse" className="btn btn-primary">Browse listings</Link>
      </div>
    );
  }

  const category = getCategory(listing.category);
  const isOwner = user?.id === listing.seller_id;
  const expired = new Date(listing.expires_at).getTime() < Date.now();
  const available = listing.status === 'active' && !expired;

  async function share() {
    if (!listing) return;
    const url = window.location.href;
    const text = listingDescription(listing);
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text, url });
      } else {
        await navigator.clipboard.writeText(`${listing.title}\n${text}\n${url}`);
        toast.success('Link copied.');
      }
    } catch {
      /* the person closed the share sheet */
    }
  }

  function showPhone() {
    if (!user || isAnonymous) return goToLogin();
    setPhoneStep('warn');
  }

  return (
    <div className="wrap page listing-page">
      {isOwner && listing.status === 'hidden' && (
        <p className="banner banner-warn" role="status">
          <TriangleAlert aria-hidden /> Several members reported this listing, so it is hidden from everyone else.
        </p>
      )}
      {listing.status === 'sold' && <p className="banner" role="status">This item has been sold.</p>}
      {listing.status === 'active' && expired && <p className="banner" role="status">This listing has expired.</p>}

      <div className="listing-layout">
        <div className="listing-main">
          <Gallery images={listing.images} category={listing.category} title={listing.title} />
          <h1>{listing.title}</h1>
          <p className="listing-price">
            <span className="price-tag price-tag-large">{formatPrice(listing.price, category.priceSuffix)}</span>
            {listing.negotiable && listing.price !== 0 && <span className="chip">Negotiable</span>}
          </p>
          <ul className="facts">
            <li><MapPin aria-hidden /> {listing.location}</li>
            <li><Clock aria-hidden /> Posted {timeAgo(listing.created_at)}</li>
            <li><Link to={`/browse?cat=${listing.category}`}>{category.label}</Link></li>
            {listing.condition && <li>Condition: {conditionLabels[listing.condition]}</li>}
          </ul>
          <h2>Description</h2>
          <p className="listing-description">{listing.description}</p>
        </div>

        <div className="listing-side">
          {isOwner ? (
            <section className="panel" aria-label="Manage this listing">
              <h2>Your listing</h2>
              <OwnerActions listing={listing} onDeleted={() => navigate('/my-listings')} />
            </section>
          ) : (
            <section className="panel" aria-label="Contact the seller">
              <div className="seller-card">
                <h2>
                  <Link to={`/seller/${listing.seller_id}`}>{listing.seller?.display_name ?? 'Member'}</Link>
                </h2>
                {listing.seller && (
                  <p className="muted">
                    Member since {memberSince(listing.seller.created_at)}
                    {isNewMember(listing.seller.created_at) && <span className="chip chip-warn">New member</span>}
                  </p>
                )}
              </div>
              {available ? (
                <div className="stack">
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => (user && !isAnonymous ? message.mutate() : goToLogin())}
                    disabled={message.isPending}
                  >
                    <MessageCircle aria-hidden /> {message.isPending ? 'Opening chat...' : 'Message seller'}
                  </button>
                  <button type="button" className="btn btn-quiet btn-block" onClick={showPhone}>
                    <Phone aria-hidden /> Show phone number
                  </button>
                </div>
              ) : (
                <p className="muted">This listing is not available for new messages.</p>
              )}
              <div className="row-actions">
                <SaveButton listingId={listing.id} label />
                <button type="button" className="btn btn-quiet" onClick={share}>
                  <Share2 aria-hidden /> Share
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => (user && !isAnonymous ? setReporting(true) : goToLogin())}>
                  <Flag aria-hidden /> Report
                </button>
              </div>
            </section>
          )}
          <SafetyPanel category={listing.category} />
        </div>
      </div>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} listingId={listing.id} subject="this listing" />

      <Dialog
        open={phoneStep !== 'closed'}
        onClose={() => setPhoneStep('closed')}
        title={phoneStep === 'warn' ? 'Read this before you call' : 'Seller phone number'}
      >
        {phoneStep === 'warn' ? (
          <div className="stack">
            <p>{defaultNotice}</p>
            {category.notice && <p>{category.notice}</p>}
            <div className="actions">
              <button type="button" className="btn btn-quiet" onClick={() => setPhoneStep('closed')}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => setPhoneStep('shown')}>I understand, show the number</button>
            </div>
          </div>
        ) : (
          <div className="stack">
            {phone.isLoading && <p aria-busy="true">Loading...</p>}
            {phone.isError && <p role="alert">{(phone.error as Error).message)}
            {phone.isSuccess && !phone.data && (
              <p>This seller has not shared a phone number. Use the message button to contact them.</p>
            )}
            {phone.data && (
              <>
                <p className="phone-number"><a href={`tel:${phone.data}`}>{phone.data}</a></p>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      void navigator.clipboard.writeText(phone.data ?? '');
                      toast.success('Number copied.');
                    }}
                  >
                    <Copy aria-hidden /> Copy
                  </button>
                  <a className="btn btn-primary" href={`tel:${phone.data}`}>Call</a>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
