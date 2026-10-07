import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { GoogleButton } from '../components/GoogleButton';
import { NEXT_KEY, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { siteUrl } from '../config/site';
import { supabase } from '../lib/supabase';
import { displayNameSchema, emailSchema, passwordSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  useDocumentTitle(signup ? 'Create an account' : 'Log in');
  const { user, loading, isAnonymous, continueAsGuest } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from ?? sessionStorage.getItem(NEXT_KEY) ?? '/';
  const accountOnlyTarget = /^\/(sell|messages|account|my-listings)(\/|$)/.test(from);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!loading && user && !isAnonymous) {
    sessionStorage.removeItem(NEXT_KEY);
    return <Navigate to={from} replace />;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const em = emailSchema.safeParse(email);
    if (!em.success) next.email = em.error.issues[0]?.message;
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) next.password = pw.error.issues[0]?.message;
    if (signup && name.trim()) {
      const nm = displayNameSchema.safeParse(name);
      if (!nm.success) next.name = nm.error.issues[0]?.message;
    }
    setErrors(next);
    if (Object.keys(next).length || !em.success || !pw.success) return;

    setBusy(true);
    sessionStorage.setItem(NEXT_KEY, from);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password: pw.data,
          options: { emailRedirectTo: siteUrl(), data: name.trim() ? { display_name: name.trim() } : {} },
        });
        if (error) {
          setErrors({ form: error.message });
        } else if (!data.session) {
          setSentTo(em.data); // email confirmation is on: the person must click the link we sent
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
        if (error) {
          setErrors({
            form: /confirm/i.test(error.message)
              ? 'Confirm your email first. Check your inbox for the link we sent.'
              : 'Wrong email or password.',
          });
        }
      }
    } catch {
      setErrors({ form: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }


  async function guest() {
    setBusy(true);
    try {
      sessionStorage.setItem(NEXT_KEY, from);
      await continueAsGuest();
      if (accountOnlyTarget) navigate('/', { replace: true });
    } catch {
      setErrors({ form: 'Guest access is not available yet. Please use an account or try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!sentTo) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: siteUrl() } });
    if (error) toast.error('Could not resend the email yet. Wait a minute and try again.');
    else toast.success('Confirmation email sent again.');
  }

  if (sentTo) {
    return (
      <div className="wrap page narrow auth-card">
        <MailCheck aria-hidden className="auth-icon" />
        <h1>Check your email</h1>
        <p>We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account.</p>
        <p className="muted">Cannot find it? Look in spam, or</p>
        <button type="button" className="btn btn-quiet" onClick={resend}>Send it again</button>
      </div>
    );
  }

  return (
    <div className="wrap page narrow auth-card">
      <h1>{signup ? 'Create your account' : 'Continue to Maua Marketplace'}</h1>
      <p className="muted">
        {signup
          ? 'Free, and your email stays private. You choose the name other members see.'
          : 'Browse listings without an account. You only need credentials when you want to contact a seller or sell something.'}
      </p>

      {!signup && !accountOnlyTarget && (
        <button type="button" className="btn btn-quiet btn-block" onClick={guest} disabled={busy}>
          Continue as guest
        </button>
      )}

      <GoogleButton next={from} />
      <p className="divider"><span>or use your email</span></p>

      <form onSubmit={submit} className="stack" noValidate>
        {signup && (
          <label className="field">
            <span>Display name (optional)</span>
            <input value={name} maxLength={40} autoComplete="nickname" onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
            <small className="hint">Shown on your listings. A nickname is fine. Leave empty and we will give you a random one.</small>
            {errors.name && <p className="field-error" role="alert">{errors.name}</p>}
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="field-error" role="alert">{errors.email}</p>}
        </label>
        <label className="field">
          <span>Password</span>
          <span className="input-with-button">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              autoComplete={signup ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            <button type="button" className="icon-btn" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          </span>
          {signup && <small className="hint">At least 8 characters.</small>}
          {errors.password && <p className="field-error" role="alert">{errors.password}</p>}
        </label>
        {errors.form && <p className="banner banner-warn" role="alert">{errors.form}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait...' : signup ? 'Create account' : 'Log in'}
        </button>
      </form>

      {!signup && <p><Link to="/forgot-password">Forgot your password?</Link></p>}
      <p>
        {signup ? 'Already have an account?' : 'New here?'}{' '}
        <Link to={signup ? '/login' : '/signup'} state={{ from }}>{signup ? 'Log in' : 'Create an account'}</Link>
      </p>
    </div>
  );
}
