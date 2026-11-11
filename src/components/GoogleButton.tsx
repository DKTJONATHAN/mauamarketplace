import { useEffect, useRef, useState } from 'react';
import { NEXT_KEY } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { env } from '../lib/env';
import { supabase } from '../lib/supabase';

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type: 'standard';
          theme: 'outline';
          size: 'large';
          text: 'continue_with';
          shape: 'rect';
          logo_alignment: 'left';
          width: number;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity-services]',
    );
    const script = existing ?? document.createElement('script');

    const onLoad = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('Google sign-in did not initialise. Please refresh and try again.'));
    };
    const onError = () => reject(new Error('Google sign-in could not load. Check your connection and try again.'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentityServices = 'true';
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

function safeInternalPath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export function GoogleButton({ next }: { next: string }) {
  const toast = useToast();
  const buttonHost = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const destination = safeInternalPath(next);
    sessionStorage.setItem(NEXT_KEY, destination);

    if (!env.googleClientId) {
      toast.error('Google sign-in is not configured. Please use email and password.');
      return () => { active = false; };
    }

    void loadGoogleIdentity()
      .then(() => {
        if (!active || !buttonHost.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: env.googleClientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            if (!active || !credential) return;
            setBusy(true);
            try {
              const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: credential,
              });
              if (error) throw error;
              // AuthContext receives SIGNED_IN and restores NEXT_KEY.
            } catch (error) {
              sessionStorage.removeItem(NEXT_KEY);
              setBusy(false);
              toast.error(error instanceof Error
                ? error.message
                : 'Google sign-in failed. Please try again.');
            }
          },
        });

        window.google.accounts.id.renderButton(buttonHost.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rect',
          logo_alignment: 'left',
          width: Math.min(400, Math.max(240, window.innerWidth - 64)),
        });
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        sessionStorage.removeItem(NEXT_KEY);
        toast.error(error instanceof Error ? error.message : 'Google sign-in could not be loaded.');
      });

    return () => { active = false; };
  }, [next, toast]);

  return (
    <div className="google-signin-wrap" aria-busy={busy || !ready}>
      {!ready && <p className="google-signin-status" role="status">{busy ? 'Connecting to Google...' : 'Loading Google sign-in...'}</p>}
      <div ref={buttonHost} className="google-signin-button-host" />
      {busy && <p className="google-signin-status" role="status">Signing you in securely...</p>}
    </div>
  );
}
