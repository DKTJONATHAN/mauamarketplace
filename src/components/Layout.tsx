import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { CircleUser, Heart, Home, MessageCircle, Plus, Search, X } from 'lucide-react';
import { featuredCategorySlugs, getCategory } from '../config/categories';
import { site } from '../config/site';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUnreadMessages } from '../hooks';
import { acceptTerms } from '../lib/api';
import { Brand } from './Brand';
import { Dialog } from './Dialog';

function DisclaimerStrip() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('mm.strip') === '1');
  if (hidden) return null;
  return (
    <div className="strip" role="note">
      <p>
        Deals here are between you and the other person. {site.name} does not verify sellers, hold money or inspect items.{' '}
        <Link to="/safety">Read the safety tips</Link>
      </p>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss notice"
        onClick={() => {
          sessionStorage.setItem('mm.strip', '1');
          setHidden(true);
        }}
      >
        <X aria-hidden />
      </button>
    </div>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/browse?q=${encodeURIComponent(term)}` : '/browse');
  }
  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${site.place}: phones, maize, sofas`}
        aria-label="Search listings"
        maxLength={60}
      />
      <button type="submit" aria-label="Search">
        <Search aria-hidden />
      </button>
    </form>
  );
}

function Header({ unread }: { unread: number }) {
  const { user, isAnonymous } = useAuth();
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Brand />
        <HeaderSearch />
        <nav className="header-actions" aria-label="Account">
          <Link to="/saved" className="icon-link" aria-label="Saved listings">
            <Heart aria-hidden />
          </Link>
          <Link to="/messages" className="icon-link" aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}>
            <MessageCircle aria-hidden />
            {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          {user && !isAnonymous ? (
            <Link to="/account" className="icon-link" aria-label="Your account">
              <CircleUser aria-hidden />
            </Link>
          ) : (
            <Link to="/login" className="text-link">
              Log in
            </Link>
          )}
          <Link to="/sell" className="btn btn-tag">
            Sell
          </Link>
        </nav>
      </div>
      <nav className="rail" aria-label="Popular categories">
        <ul className="wrap">
          {featuredCategorySlugs.map((slug) => {
            const c = getCategory(slug);
            return (
              <li key={slug}>
                <Link to={`/browse?cat=${slug}`}>{c.label}</Link>
              </li>
            );
          })}
          <li>
            <Link to="/categories" className="rail-all">
              All categories
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <Brand />
          <p className="muted">
            A free notice board for {site.place}, {site.region}. We do not handle payments, verify sellers or settle
            disputes, so please read the safety tips.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul>
            <li><Link to="/sell">Post a listing</Link></li>
            <li><Link to="/categories">All categories</Link></li>
            <li><Link to="/safety">Safety tips</Link></li>
            <li><Link to="/rules">Rules and privacy</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

function BottomNav({ unread }: { unread: number }) {
  const { user, isAnonymous } = useAuth();
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/" end>
        <Home aria-hidden />
        <span>Home</span>
      </NavLink>
      <NavLink to="/browse">
        <Search aria-hidden />
        <span>Browse</span>
      </NavLink>
      <NavLink to="/sell" className="bottom-sell">
        <Plus aria-hidden />
        <span>Sell</span>
      </NavLink>
      <NavLink to="/messages">
        <span className="bottom-icon">
          <MessageCircle aria-hidden />
          {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </span>
        <span>Chats</span>
      </NavLink>
      <NavLink to={user && !isAnonymous ? '/account' : '/login'}>
        <CircleUser aria-hidden />
        <span>{user && !isAnonymous ? 'Account' : 'Log in'}</span>
      </NavLink>
    </nav>
  );
}

function TermsGate() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const needed = Boolean(user && profile && !profile.accepted_terms_at);

  async function accept() {
    if (!user) return;
    setBusy(true);
    try {
      await acceptTerms(user.id);
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={needed} onClose={() => undefined} title="Before you continue" dismissible={false}>
      <div className="stack">
        <p>{site.name} is a notice board. Anything you buy or sell is a deal between you and the other person.</p>
        <ul className="plain-list">
          <li>We do not verify members, hold money, inspect items or settle disputes.</li>
          <li>Meet in public, inspect first, and pay only when you are happy.</li>
          <li>Your email stays private. Your display name, listings and photos are public.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I am 18 or older and I accept the{' '}
            <a href={`${import.meta.env.BASE_URL}#/rules`} target="_blank" rel="noreferrer">
              rules and privacy notice
            </a>
            .
          </span>
        </label>
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={!agreed || busy} onClick={accept}>
            {busy ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  const unread = useUnreadMessages();
  return (
    <>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <ScrollToTop />
      <DisclaimerStrip />
      <Header unread={unread} />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <BottomNav unread={unread} />
      <TermsGate />
    </>
  );
}
