import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../hooks';

export function ConfirmEmailPage() {
  useDocumentTitle('Email verified', true);
  const navigate = useNavigate();
  const [state, setState] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    let active = true;

    async function verify() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const code = searchParams.get('code') ?? hashParams.get('code');
      const tokenHash = searchParams.get('token_hash') ?? hashParams.get('token_hash');
      const type = (searchParams.get('type') ?? hashParams.get('type') ?? 'email') as EmailOtpType;

      // Sign-up uses PKCE, so Supabase normally returns an auth code that
      // must be exchanged for a session. Keep token_hash support as a fallback
      // for older/custom email templates.
      if (!code && !tokenHash) {
        if (active) {
          setState('error');
          setMessage('This verification link is missing or incomplete. Please request a new confirmation email.');
        }
        return;
      }

      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash as string, type });
      if (!active) return;

      if (error) {
        setState('error');
        setMessage(/expired|invalid/i.test(error.message)
          ? 'This verification link has expired or has already been used. Please request a new one.'
          : 'We could not verify this email address. Please request a new confirmation email.');
        return;
      }

      setState('success');
      setMessage('Your email address has been verified. Your Maua Marketplace account is ready.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);

      window.setTimeout(() => navigate('/', { replace: true }), 1600);
    }

    void verify();
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="wrap page narrow auth-card">
      <MailCheck aria-hidden className="auth-icon" />
      <h1>{state === 'success' ? 'Email verified' : state === 'error' ? 'Verification problem' : 'Verifying your email'}</h1>
      <p>{message}</p>
      {state === 'success' && <p className="muted">Taking you to Maua Marketplace...</p>}
      {state === 'error' && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/signup', { replace: true })}>
          Create account again
        </button>
      )}
    </div>
  );
}
