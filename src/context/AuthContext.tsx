import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/api';
import type { Profile } from '../lib/types';

export const NEXT_KEY = 'mm.next';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  isAnonymous: boolean;
  continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        if (data.session) {
          setSession(data.session);
          return;
        }

        const { data: guest, error } = await supabase.auth.signInAnonymously();
        if (!active) return;
        if (!error) setSession(guest.session);
      } finally {
        if (active) setLoading(false);
      }
    }

    void initializeAuth();

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true });
      if (event === 'SIGNED_IN') {
        const target = sessionStorage.getItem(NEXT_KEY);
        if (target) {
          sessionStorage.removeItem(NEXT_KEY);
          navigate(target, { replace: true });
        }
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || session?.user?.is_anonymous) return;
    let active = true;
    void (async () => {
      try {
        const raw = localStorage.getItem('mm.guest-saved');
        const ids = raw ? JSON.parse(raw) as string[] : [];
        if (!ids.length) return;
        const rows = ids.filter((id): id is string => typeof id === 'string').map((listing_id) => ({ listing_id }));
        if (rows.length) {
          await supabase.from('saved_listings').upsert(rows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
        }
        if (active) localStorage.removeItem('mm.guest-saved');
      } catch {
        // Keep guest favourites if the migration cannot complete yet.
      }
    })();
    return () => { active = false; };
  }, [userId, session?.user?.is_anonymous]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setProfile(p))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfile(await fetchProfile(userId));
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const continueAsGuest = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    setSession(data.session);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signOut,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      continueAsGuest,
    }),
    [session, profile, loading, refreshProfile, signOut, continueAsGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
