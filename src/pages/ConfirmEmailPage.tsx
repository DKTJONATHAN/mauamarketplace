import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NEXT_KEY } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../hooks';

function safeInternalPath(path: string | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export function ConfirmEmailPage() {
  useDocumentTitle('Email verified', true);
  const navigate = useNavigate();
  const [state, setState] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Completing your sign-in...');

  useEffect(() => {
    let active = true;

    async function verify() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const code = searchParams.get('code') ?? hashParams.get('code');
      const tokenHash = searchParams.get('token_hash') ?? hashParams.get('token_hash');
      const type = (searchParams.get('type') ?? hashParams.get('type') ?? 'email') as EmailOtpType;
      const next = safeInternalPath(searchParams.get('next') ?? sessionStorage.getItem(NEXT_KEY));
      const authError = searchParams.get('error_description') ?? searchParams.get('error');

      if (authError) {
        if (active) {
          setState('error');
          setMessage(authError.replace(/\+/g, ' '));
        }
        return;
      }

      if (code) {
        // The Supabase client may already have consumed the PKCE callback during
        // initialization. Check for that session first to avoid exchanging twice.
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) {
              setState('error');
              setMessage(/expired|invalid/i.test(error.message)
                ? 'This sign-in link has expired or has already been used. Please try again.'
                : 'We could not complete Google sign-in. Please try again.');
            }
            return;
          }
        }

        if (!active) return;
        sessionStorage.removeItem(NEXT_KEY);
        setState('success');
        setMessage('You are signed in. Taking you back to Maua Marketplace...');
        window.history.replaceState({}, document.title, window.location.pathname);
        window.setTimeout(() => navigate(next, { replace: true }), 500);
        return;
      }

      if (!tokenHash) {
        if (active) {
          setState('error');
          setMessage('This verification link is missing or incomplete. Please request a new confirmation email.');
        }
        return;
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
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
      window.history.replaceState({}, document.title, window.location.pathname);
      window.setTimeout(() => navigate('/', { replace: true }), 1600);
    }

    void verify().catch(() => {
      if (active) {
        setState('error');
        setMessage('We could not complete authentication. Please return to login and try again.');
      }
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="wrap page narrow auth-card">
      <MailCheck aria-hidden className="auth-icon" />
      <h1>{state === 'success' ? 'You are signed in' : state === 'error' ? 'Authentication problem' : 'Completing sign-in'}</h1>
      <p>{message}</p>
      {state === 'success' && <p className="muted">Taking you to Maua Marketplace...</p>}
      {state === 'error' && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/login', { replace: true })}>
          Back to login
        </button>
      )}
    </div>
  );
}
