import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adPackages, submitAdvertisingRequest, type AdDuration, type AdPlacement } from '../lib/advertising';
import { useDocumentTitle } from '../hooks';
import './advertise.css';

const placements: AdPlacement[] = ['homepage_banner', 'category_feature', 'business_spotlight'];

export function AdvertisePage() {
  useDocumentTitle('Advertise with Maua Marketplace');
  const { user, isAnonymous } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [placement, setPlacement] = useState<AdPlacement>('homepage_banner');
  const [duration, setDuration] = useState<AdDuration>(7);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [startDate, setStartDate] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selected = adPackages[placement];
  const price = duration === 7 ? selected.weeklyPrice : selected.monthlyPrice;
  const minimumDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isAnonymous) {
      navigate('/login?next=%2Fadvertise');
      return;
    }
    setSubmitting(true);
    try {
      await submitAdvertisingRequest({
        businessName, contactPhone: phone, websiteUrl: website, placement,
        durationDays: duration, startDate, creativeUrl, notes,
      });
      toast.success('Advertising request received. We will contact you to arrange payment and confirm your slot.');
      setBusinessName(''); setPhone(''); setWebsite(''); setCreativeUrl(''); setNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap page advertise-page">
      <header className="advertise-intro">
        <span className="advertise-eyebrow">REACH LOCAL CUSTOMERS</span>
        <h1>Put your business in the local spotlight.</h1>
        <p>Reach people browsing products, services and businesses around Maua and nearby Meru communities. Choose a placement and a campaign length that fits your budget.</p>
        <a className="btn btn-primary" href="#ad-packages">View advertising options <ArrowRight size={16} aria-hidden /></a>
      </header>

      <section className="advertise-principles" aria-label="Advertising information">
        <div><strong>Clear pricing</strong><span>Know the fee before you request a slot.</span></div>
        <div><strong>Relevant placement</strong><span>Choose the part of the marketplace that suits your audience.</span></div>
        <div><strong>Clearly labelled</strong><span>Paid placements are identified as sponsored advertising.</span></div>
      </section>

      <section id="ad-packages" className="advertise-section">
        <div className="advertise-section-heading">
          <div><span className="advertise-eyebrow">ADVERTISING OPTIONS</span><h2>Choose where to appear</h2></div>
          <p>Introductory rates in Kenyan shillings. Your slot is confirmed after payment and creative review.</p>
        </div>
        <div className="advertise-package-grid">
          {placements.map((key) => {
            const item = adPackages[key];
            return (
              <button type="button" key={key} className={placement === key ? 'advertise-package is-selected' : 'advertise-package'} onClick={() => setPlacement(key)} aria-pressed={placement === key}>
                <span className="advertise-package-name">{item.name}</span>
                <span className="advertise-package-price">KSh {item.weeklyPrice.toLocaleString('en-KE')}<small> / 7 days</small></span>
                <span className="advertise-package-month">KSh {item.monthlyPrice.toLocaleString('en-KE')} <small>/ 30 days</small></span>
                <span className="advertise-package-description">{item.description}</span>
                <span className="advertise-package-location">{item.placementLabel}</span>
                <span className="advertise-package-select">{placement === key ? <><Check size={15} /> Selected</> : 'Choose placement'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="advertise-booking" aria-labelledby="advertise-booking-title">
        <div className="advertise-booking-copy">
          <span className="advertise-eyebrow">BOOK A CAMPAIGN</span>
          <h2 id="advertise-booking-title">Reserve your advertising space.</h2>
          <p>Tell us about your business and when you would like your campaign to run. We will review the creative, contact you on the number provided and send payment instructions.</p>
          <ul>
            <li><Check size={16} /> Your selected placement: {selected.name}</li>
            <li><Check size={16} /> {duration} days of advertising</li>
            <li><Check size={16} /> Final confirmation after payment and review</li>
          </ul>
          <p className="advertise-booking-total">Campaign total <strong>KSh {price.toLocaleString('en-KE')}</strong></p>
          <p className="advertise-smallprint">We do not guarantee a specific number of views, clicks or sales. Placement dates depend on availability.</p>
        </div>

        <form className="advertise-form" onSubmit={submit}>
          <h3>Campaign details</h3>
          {!user || isAnonymous ? <p className="advertise-signin-note">Sign in to submit and track an advertising request.</p> : null}
          <label>Business or organisation name<input required minLength={2} maxLength={100} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Maua Fresh Produce" /></label>
          <label>Contact phone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={16} value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" /></label>
          <label>Website or social page <span className="advertise-optional">Optional</span><input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" /></label>
          <div className="advertise-form-row">
            <label>Campaign length<select value={duration} onChange={e => setDuration(Number(e.target.value) as AdDuration)}><option value={7}>7 days</option><option value={30}>30 days</option></select></label>
            <label>Preferred start date<input required type="date" min={minimumDate} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          </div>
          <label>Artwork or image URL <span className="advertise-optional">Optional</span><input type="url" value={creativeUrl} onChange={e => setCreativeUrl(e.target.value)} placeholder="Link to your banner or advert image" /></label>
          <label>What would you like customers to know? <span className="advertise-optional">Optional</span><textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe your offer, service or campaign..." /></label>
          <button className="btn btn-primary advertise-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting request…' : !user || isAnonymous ? 'Sign in to continue' : 'Request this ad slot · KSh ' + price.toLocaleString('en-KE')} <ArrowRight size={16} aria-hidden /></button>
          <p className="advertise-payment-note">This submits a booking request, not a payment. We will confirm availability and send M-Pesa payment instructions before the campaign is scheduled.</p>
        </form>
      </section>

      <section className="advertise-boost-callout">
        <div><Megaphone size={22} aria-hidden /><div><h2>Just want more eyes on one listing?</h2><p>Boost an active product or service listing instead of booking a business advert.</p></div></div>
        <Link to="/my-listings" className="btn btn-tag">Promote a listing <ArrowRight size={16} aria-hidden /></Link>
      </section>
    </div>
  );
}
