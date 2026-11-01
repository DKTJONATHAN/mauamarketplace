import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, Bookmark, CalendarDays, ChevronRight, CircleUserRound, LayoutDashboard,
  LogOut, Mail, MessageCircle, Package, ShieldBan, Trash2, UserRound,
} from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchBlockedUsers, setBlocked, updateDisplayName } from '../lib/api';
import { deleteMyAccount } from '../lib/media';
import { supabase } from '../lib/supabase';
import { displayNameSchema } from '../lib/validation';
import { memberSince } from '../lib/format';
import { useDocumentTitle } from '../hooks';

export function AccountPage() {
  useDocumentTitle('Your account', true);
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const blocked = useQuery({ queryKey: ['blocked', user?.id], queryFn: fetchBlockedUsers, enabled: Boolean(user) });

  const rename = useMutation({
    mutationFn: (value: string) => updateDisplayName(user?.id as string, value),
    onSuccess: async () => {
      await refreshProfile();
      setName(null);
      toast.success('Display name updated.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblock = useMutation({
    mutationFn: (id: string) => setBlocked(id, false),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['blocked'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const erase = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      await supabase.auth.signOut({ scope: 'local' });
      qc.clear();
      toast.success('Your account and data have been deleted.');
      navigate('/', { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function saveName(e: FormEvent) {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name ?? '');
    if (!parsed.success) return setNameError(parsed.error.issues[0]?.message ?? 'Check the name.');
    setNameError('');
    rename.mutate(parsed.data);
  }

  if (!user) return null;
  const current = name ?? profile?.display_name ?? '';
  const initial = (profile?.display_name || user.email || 'M').trim().charAt(0).toUpperCase();
  const joined = profile ? memberSince(profile.created_at) : '—';

  return (
    <div className="wrap page account-page">
      <span className="account-eyebrow">Your space on Maua Marketplace</span>
      <h1>Your account</h1>

      <section className="account-profile-hero" aria-label="Profile overview">
        <span className="account-avatar" aria-hidden>{initial}</span>
        <div className="account-profile-copy">
          <span className="account-eyebrow">Member profile</span>
          <h2>{profile?.display_name || 'Your profile'}</h2>
          <p>Manage your details, listings and conversations.</p>
          <div className="account-profile-meta">
            <span><CalendarDays aria-hidden size={14} /> Member since {joined}</span>
            <span><ShieldBan aria-hidden size={14} /> Your email is private</span>
          </div>
        </div>
      </section>

      <div className="account-layout">
        <div className="account-main-column">
          <section className="panel stack" aria-labelledby="acc-profile">
            <div className="account-section-heading"><UserRound aria-hidden /><h2 id="acc-profile">Profile details</h2></div>
            <form onSubmit={saveName} className="account-profile-form" noValidate>
              <label className="field">
                <span>Display name</span>
                <input value={current} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} />
                <small className="hint">This is the name other members see. You do not need to use your real name.</small>
                {nameError && <p className="field-error" role="alert">{nameError}</p>}
              </label>
              <div className="actions">
                <button type="submit" className="btn btn-primary" disabled={rename.isPending || name === null || name === profile?.display_name}>
                  {rename.isPending ? 'Saving…' : 'Save display name'}
                </button>
              </div>
            </form>
            <dl className="account-facts">
              <div><dt><Mail aria-hidden size={14} /> Email address</dt><dd>{user.email} <span className="muted">(private)</span></dd></div>
              <div><dt><CalendarDays aria-hidden size={14} /> Member since</dt><dd>{joined}</dd></div>
            </dl>
          </section>

          <section className="panel stack" aria-labelledby="acc-links">
            <div className="account-section-heading"><LayoutDashboard aria-hidden /><h2 id="acc-links">Your marketplace</h2></div>
            <ul className="account-activity-list">
              <li><Link to="/seller-dashboard"><Package aria-hidden /> Seller dashboard <ChevronRight className="account-link-arrow" aria-hidden /></Link></li>
              <li><Link to="/my-listings"><UserRound aria-hidden /> My listings <ChevronRight className="account-link-arrow" aria-hidden /></Link></li>
              <li><Link to="/saved"><Bookmark aria-hidden /> Saved listings <ChevronRight className="account-link-arrow" aria-hidden /></Link></li>
              <li><Link to="/messages"><MessageCircle aria-hidden /> Messages <ChevronRight className="account-link-arrow" aria-hidden /></Link></li>
            </ul>
          </section>
        </div>

        <aside className="account-side-column">
          <section className="panel stack" aria-labelledby="acc-blocked">
            <div className="account-section-heading"><ShieldBan aria-hidden /><h2 id="acc-blocked">Blocked members</h2></div>
            {blocked.isLoading && <p className="muted">Loading blocked members…</p>}
            {blocked.data && blocked.data.length === 0 && <p className="muted">You have not blocked anyone.</p>}
            <ul className="account-blocked-list">
              {blocked.data?.map((b) => (
                <li key={b.blocked_id}>
                  <span>{b.name}</span>
                  <button type="button" className="btn btn-quiet" onClick={() => unblock.mutate(b.blocked_id)} disabled={unblock.isPending}>Unblock</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel stack">
            <div className="account-section-heading"><LogOut aria-hidden /><h2>Sign out</h2></div>
            <p className="muted">Sign out of this device. Your listings and account remain available.</p>
            <button type="button" className="btn btn-quiet account-logout" onClick={() => void signOut().then(() => navigate('/'))}>
              <LogOut aria-hidden size={17} /> Log out
            </button>
          </section>

          <section className="panel account-danger stack" aria-labelledby="acc-delete">
            <div className="account-section-heading"><Trash2 aria-hidden /><h2 id="acc-delete">Delete your account</h2></div>
            <p className="muted">
              This removes your profile, listings, saved items and conversations (including the other person's copy), and takes your
              photos off the site. It cannot be undone.
            </p>
            <button type="button" className="btn btn-danger-solid" onClick={() => setDeleting(true)}>Delete my account</button>
          </section>
        </aside>
      </div>

      <Dialog open={deleting} onClose={() => { setDeleting(false); setConfirmText(''); }} title="Delete your account?">
        <div className="stack">
          <p>Type <strong>DELETE</strong> to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" />
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => { setDeleting(false); setConfirmText(''); }}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" disabled={confirmText !== 'DELETE' || erase.isPending} onClick={() => erase.mutate()}>
              {erase.isPending ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
