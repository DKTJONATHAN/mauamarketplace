import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ImagePlus, Megaphone, Store, X } from 'lucide-react';
import { MpesaPayButton } from '../components/MpesaPayButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { absoluteUrl, mediaUrl } from '../config/site';
import { fetchMyListings } from '../lib/api';
import {
  adPackages,
  fetchAdvertisingPaymentStatus,
  queryAdvertisingPayment,
  startAdvertisingPayment,
  submitAdvertisingRequest,
  type AdDuration,
  type AdPlacement,
} from '../lib/advertising';
import { prepareImage } from '../lib/image';
import { uploadImage } from '../lib/media';
import type { ListingSummary } from '../lib/types';
import { useGoToLogin, useSeo } from '../hooks';
import './advertise.css';

const placements: AdPlacement[] = ['homepage_banner', 'category_feature', 'business_spotlight'];

type CreativeSource = 'upload' | 'listing';

function advertisingFeedback(
  status?: string,
  resultCode?: number | null,
  message?: string,
  paymentStartError?: string,
  isLoading?: boolean,
): { title: string; body: string } {
  if (status === 'paid') {
    return {
      title: 'Payment successful',
      body: 'Your campaign is paid. We will review the creative and schedule the slot for your chosen dates.',
    };
  }
  if (status === 'pending') {
    return {
      title: 'Waiting for M-PESA confirmation',
      body: 'A Lipa na M-PESA prompt was sent to your phone. Enter your PIN on the phone to complete payment.',
    };
  }
  if (status === 'failed') {
    if (resultCode === 1) {
      return {
        title: 'Insufficient funds',
        body: 'Your M-PESA balance is too low. Top up, then send a new payment prompt.',
      };
    }
    if (resultCode === 1038) {
      return {
        title: 'Payment failed',
        body: 'The M-PESA prompt timed out. Send a new prompt when you are ready.',
      };
    }
    if (resultCode === 1032) {
      return {
        title: 'Payment failed',
        body: 'The payment was cancelled on your phone. You can try again when ready.',
      };
    }
    return {
      title: 'Payment failed',
      body: message || 'The payment could not be completed. Please try again.',
    };
  }
  if (isLoading) {
    return {
      title: 'Checking payment',
      body: 'Your request is saved. We are checking the payment status.',
    };
  }
  return {
    title: 'Advertising request saved',
    body: paymentStartError || 'Send the Lipa na M-PESA prompt to complete payment for this slot.',
  };
}

export function AdvertisePage() {
  useSeo({
    title: 'Advertise Your Business in Maua and Meru | Maua Marketplace',
    path: '/advertise',
    description:
      'Promote your business or one of your listings on Maua Marketplace. Homepage, category and spotlight placements with clear KSh pricing and Lipa na M-PESA payment.',
  });
  const { user, isAnonymous } = useAuth();
  const toast = useToast();
  const goToLogin = useGoToLogin();

  const [placement, setPlacement] = useState<AdPlacement>('homepage_banner');
  const [duration, setDuration] = useState<AdDuration>(7);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [creativeSource, setCreativeSource] = useState<CreativeSource>('upload');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [startingPayment, setStartingPayment] = useState(false);
  const [paymentStartError, setPaymentStartError] = useState('');

  const myListings = useQuery({
    queryKey: ['my-listings-for-ads', user?.id],
    queryFn: () => fetchMyListings(user!.id),
    enabled: Boolean(user && !isAnonymous),
  });

  const activeListings = useMemo(
    () => (myListings.data ?? []).filter((item) => item.status === 'active'),
    [myListings.data],
  );

  const selectedListing: ListingSummary | null = useMemo(
    () => activeListings.find((item) => item.id === selectedListingId) ?? null,
    [activeListings, selectedListingId],
  );

  const payment = useQuery({
    queryKey: ['advertising-payment', bookingId],
    queryFn: () => fetchAdvertisingPaymentStatus(bookingId as string),
    enabled: Boolean(bookingId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    retry: false,
  });

  useQuery({
    queryKey: ['advertising-daraja-reconcile', bookingId],
    queryFn: async () => {
      await queryAdvertisingPayment(bookingId as string);
      await payment.refetch();
      return true;
    },
    enabled: Boolean(bookingId) && payment.data?.status === 'pending',
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const selected = adPackages[placement];
  const price = duration === 7 ? selected.weeklyPrice : selected.monthlyPrice;
  const minimumDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await prepareImage(file);
      const path = await uploadImage(prepared.blob);
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
      setUploadedPath(path);
      setUploadPreview(URL.createObjectURL(file));
      setCreativeSource('upload');
      setSelectedListingId(null);
      toast.success('Advert image uploaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  }

  function chooseListing(listing: ListingSummary) {
    setCreativeSource('listing');
    setSelectedListingId(listing.id);
    setBusinessName(listing.title);
    setWebsite('');
    setUploadedPath(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview(null);
    }
  }

  function clearCreative() {
    setUploadedPath(null);
    setSelectedListingId(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview(null);
    }
  }

  async function retryPayment() {
    if (!bookingId || !phone.trim()) return;
    setStartingPayment(true);
    setPaymentStartError('');
    try {
      await startAdvertisingPayment(bookingId, phone);
      toast.success('M-PESA prompt sent. Approve it on your phone.');
      await payment.refetch();
    } catch (error) {
      setPaymentStartError(error instanceof Error ? error.message : 'Could not start M-PESA payment.');
    } finally {
      setStartingPayment(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isAnonymous) {
      goToLogin();
      return;
    }

    let creativeUrl = '';
    let websiteUrl = website.trim();

    if (creativeSource === 'listing' && selectedListing) {
      const firstImage = selectedListing.images?.[0];
      creativeUrl = firstImage ? mediaUrl(firstImage) : '';
      websiteUrl = absoluteUrl(`/listing/${selectedListing.id}`);
    } else if (uploadedPath) {
      creativeUrl = mediaUrl(uploadedPath);
    }

    setSubmitting(true);
    try {
      const requestId = await submitAdvertisingRequest({
        businessName: businessName.trim() || selectedListing?.title || 'Business',
        contactPhone: phone,
        websiteUrl,
        placement,
        durationDays: duration,
        startDate,
        creativeUrl,
        notes,
      });
      setBookingId(requestId);
      setPaymentStartError('');
      try {
        await startAdvertisingPayment(requestId, phone);
        toast.success('Lipa na M-PESA prompt sent. Approve it on your phone.');
      } catch (paymentError) {
        const message = paymentError instanceof Error ? paymentError.message : 'Could not start M-PESA payment.';
        setPaymentStartError(message);
        toast.error(`Your request was saved, but payment could not start: ${message}`);
      }
      setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  const feedback = advertisingFeedback(
    payment.data?.status,
    payment.data?.resultCode,
    payment.data?.message,
    paymentStartError,
    payment.isLoading,
  );

  const creativePreview =
    creativeSource === 'listing' && selectedListing?.images?.[0]
      ? mediaUrl(selectedListing.images[0])
      : uploadPreview;

  return (
    <div className="wrap page advertise-page">
      <header className="advertise-intro">
        <span className="advertise-eyebrow">ADVERTISE ON MAUA MARKETPLACE</span>
        <h1>Reach shoppers already looking for products and services near Maua.</h1>
        <p>
          Book a sponsored slot on the homepage, category pages, or discovery areas. Pay with Lipa na M-PESA.
          You can upload your own advert image, or promote one of your existing listings as the creative.
        </p>
        <a className="btn btn-primary" href="#ad-packages">
          See placements and prices <ArrowRight size={16} aria-hidden />
        </a>
      </header>

      <section className="advertise-principles" aria-label="How advertising works">
        <div>
          <strong>1. Choose a placement</strong>
          <span>Homepage banner, category feature, or business spotlight — each reaches a different audience.</span>
        </div>
        <div>
          <strong>2. Add your creative</strong>
          <span>Upload an image from your phone, or select one of your active listings to use as the ad.</span>
        </div>
        <div>
          <strong>3. Pay with M-PESA</strong>
          <span>We send a Lipa na M-PESA prompt. After payment we review and schedule your campaign.</span>
        </div>
      </section>

      <section id="ad-packages" className="advertise-section">
        <div className="advertise-section-heading">
          <div>
            <span className="advertise-eyebrow">PLACEMENTS</span>
            <h2>Where your advert will appear</h2>
          </div>
          <p>
            Prices are in Kenyan shillings. Your slot goes live only after payment is confirmed and the creative is
            approved.
          </p>
        </div>
        <div className="advertise-package-grid">
          {placements.map((key) => {
            const item = adPackages[key];
            return (
              <button
                type="button"
                key={key}
                className={placement === key ? 'advertise-package is-selected' : 'advertise-package'}
                onClick={() => setPlacement(key)}
                aria-pressed={placement === key}
                disabled={Boolean(bookingId)}
              >
                <span className="advertise-package-name">{item.name}</span>
                <span className="advertise-package-price">
                  KSh {item.weeklyPrice.toLocaleString('en-KE')}
                  <small> / 7 days</small>
                </span>
                <span className="advertise-package-month">
                  KSh {item.monthlyPrice.toLocaleString('en-KE')} <small>/ 30 days</small>
                </span>
                <span className="advertise-package-description">{item.description}</span>
                <span className="advertise-package-location">{item.placementLabel}</span>
                <span className="advertise-package-select">
                  {placement === key ? (
                    <>
                      <Check size={15} /> Selected
                    </>
                  ) : (
                    'Choose placement'
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="advertise-booking" aria-labelledby="advertise-booking-title">
        <div className="advertise-booking-copy">
          <span className="advertise-eyebrow">BOOK A CAMPAIGN</span>
          <h2 id="advertise-booking-title">Tell us what to show shoppers.</h2>
          <p>
            Website and social links are optional. If you promote one of your listings, we use that listing’s photo and
            send visitors to the listing page automatically.
          </p>
          <ul>
            <li>
              <Check size={16} /> Placement: {selected.name}
            </li>
            <li>
              <Check size={16} /> Duration: {duration} days
            </li>
            <li>
              <Check size={16} /> Payment: Lipa na M-PESA prompt on your phone
            </li>
          </ul>
          <p className="advertise-booking-total">
            Campaign total <strong>KSh {price.toLocaleString('en-KE')}</strong>
          </p>
          <p className="advertise-smallprint">
            We do not guarantee views, clicks or sales. Start date may shift slightly after creative review.
          </p>
        </div>

        {!bookingId ? (
          <form className="advertise-form" onSubmit={submit}>
            <h3>Campaign details</h3>
            {!user || isAnonymous ? (
              <p className="advertise-signin-note">Sign in to book a slot and pay with M-PESA.</p>
            ) : null}

            <fieldset className="advertise-source" disabled={Boolean(bookingId)}>
              <legend>What are you advertising?</legend>
              <div className="advertise-source-options">
                <button
                  type="button"
                  className={creativeSource === 'upload' ? 'is-active' : ''}
                  onClick={() => {
                    setCreativeSource('upload');
                    setSelectedListingId(null);
                  }}
                >
                  <ImagePlus size={16} aria-hidden /> Upload my own advert image
                </button>
                <button
                  type="button"
                  className={creativeSource === 'listing' ? 'is-active' : ''}
                  onClick={() => setCreativeSource('listing')}
                  disabled={!user || isAnonymous}
                >
                  <Store size={16} aria-hidden /> Use one of my listings
                </button>
              </div>
            </fieldset>

            {creativeSource === 'upload' && (
              <div className="advertise-upload">
                <label className="advertise-upload-box">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void onPickImage(e.target.files?.[0])}
                    disabled={uploading || !user || isAnonymous}
                  />
                  {creativePreview ? (
                    <img src={creativePreview} alt="Advert preview" />
                  ) : (
                    <span>
                      <ImagePlus size={22} aria-hidden />
                      {uploading ? 'Uploading…' : 'Choose image from your device'}
                    </span>
                  )}
                </label>
                {uploadedPath && (
                  <button type="button" className="btn btn-quiet" onClick={clearCreative}>
                    <X size={14} aria-hidden /> Remove image
                  </button>
                )}
                <p className="advertise-optional">JPEG, PNG or WebP. Optional — you can still book and send artwork later.</p>
              </div>
            )}

            {creativeSource === 'listing' && (
              <div className="advertise-listings">
                {!user || isAnonymous ? (
                  <p className="advertise-signin-note">Sign in to load your listings.</p>
                ) : myListings.isLoading ? (
                  <p className="advertise-optional">Loading your listings…</p>
                ) : activeListings.length === 0 ? (
                  <p className="advertise-optional">
                    You have no active listings yet.{' '}
                    <Link to="/sell">Post a listing</Link> first, or upload your own advert image instead.
                  </p>
                ) : (
                  <div className="advertise-listing-grid" role="listbox" aria-label="Your active listings">
                    {activeListings.map((listing) => {
                      const thumb = listing.images?.[0] ? mediaUrl(listing.images[0]) : null;
                      const selected = listing.id === selectedListingId;
                      return (
                        <button
                          type="button"
                          key={listing.id}
                          role="option"
                          aria-selected={selected}
                          className={selected ? 'advertise-listing-card is-selected' : 'advertise-listing-card'}
                          onClick={() => chooseListing(listing)}
                        >
                          {thumb ? <img src={thumb} alt="" /> : <span className="advertise-listing-fallback">No photo</span>}
                          <span className="advertise-listing-title">{listing.title}</span>
                          {selected && (
                            <span className="advertise-listing-check">
                              <Check size={14} /> Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="advertise-optional">
                  Visitors who tap the ad will open that listing page. No website link required.
                </p>
              </div>
            )}

            <label>
              Business or campaign name
              <input
                required
                minLength={2}
                maxLength={100}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Maua Fresh Produce"
              />
            </label>

            <label>
              M-PESA phone number
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={16}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
              />
              <small className="advertise-optional">
                We send the Lipa na M-PESA prompt here. Enter your PIN only on your phone — never on this website.
              </small>
            </label>

            {creativeSource === 'upload' && (
              <label>
                Website or social page <span className="advertise-optional">Optional</span>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://… (optional)"
                />
                <small className="advertise-optional">
                  Leave blank if you only want people to see your name and message. Not required.
                </small>
              </label>
            )}

            <div className="advertise-form-row">
              <label>
                Campaign length
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as AdDuration)}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>
              <label>
                Preferred start date
                <input
                  required
                  type="date"
                  min={minimumDate}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
            </div>

            <label>
              Message to shoppers <span className="advertise-optional">Optional</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Short offer, hours, or what you want people to know…"
              />
            </label>

            <MpesaPayButton
              type="submit"
              fullWidth
              loading={submitting || uploading}
              loadingLabel={uploading ? 'Uploading image…' : 'Sending M-PESA prompt…'}
              disabled={!user || isAnonymous || uploading}
            >
              {!user || isAnonymous
                ? 'Sign in to pay with M-PESA'
                : `Pay KSh ${price.toLocaleString('en-KE')} with M-PESA`}
            </MpesaPayButton>
            <p className="advertise-payment-note">
              Submitting sends a Lipa na M-PESA STK prompt to your phone. Your advert is scheduled only after payment and
              review.
            </p>
          </form>
        ) : (
          <div
            className={payment.data?.status === 'paid' ? 'advertise-payment-state is-paid' : 'advertise-payment-state'}
            role="status"
            aria-live="polite"
          >
            <strong>{feedback.title}</strong>
            <p>{feedback.body}</p>
            {paymentStartError && <p className="field-error">{paymentStartError}</p>}
            {(payment.data?.status === 'unpaid' ||
              payment.data?.status === 'failed' ||
              paymentStartError ||
              payment.isError) && (
              <MpesaPayButton onClick={() => void retryPayment()} loading={startingPayment} disabled={!phone.trim()}>
                Send M-PESA prompt again
              </MpesaPayButton>
            )}
            {payment.data?.status === 'pending' && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => void payment.refetch()}
                disabled={payment.isFetching}
              >
                {payment.isFetching ? 'Checking…' : 'Check payment status'}
              </button>
            )}
            {payment.data?.status === 'paid' && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setBookingId(null);
                  setPaymentStartError('');
                  setPhone('');
                  clearCreative();
                  setBusinessName('');
                }}
              >
                Book another campaign
              </button>
            )}
          </div>
        )}
      </section>

      <section className="advertise-boost-callout">
        <div>
          <Megaphone size={22} aria-hidden />
          <div>
            <h2>Only need more views on one product?</h2>
            <p>Boost a single active listing for KSh 250 / 30 days — cheaper than a full business campaign.</p>
          </div>
        </div>
        <Link to="/my-listings" className="btn btn-tag">
          Promote a listing <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </div>
  );
}
