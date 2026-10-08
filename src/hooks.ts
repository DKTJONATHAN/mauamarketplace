import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, NEXT_KEY } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { fetchSavedIds, fetchUnreadCount, setSaved } from './lib/api';
import { supabase } from './lib/supabase';
import { applySeo, type SeoProps } from './lib/seo';

/**
 * Full SEO head management (title, description, Open Graph, Twitter, canonical, JSON-LD).
 * Prefer this on public pages. Private/utility pages can pass noindex: true.
 */
export function useSeo(props: SeoProps = {}): void {
  const { title, description, path, image, type, noindex, jsonLd } = props;
  // Stable dependency so a new object identity every render does not re-run the effect forever.
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    applySeo({ title, description, path, image, type, noindex, jsonLd });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jsonLdKey stands in for jsonLd
  }, [title, description, path, image, type, noindex, jsonLdKey]);
}

/** Convenience wrapper that only sets the document title (and basic defaults). */
export function useDocumentTitle(title?: string): void {
  useSeo({ title });
}

/** Returns a function that sends the visitor to the login page and brings them back afterwards. */
export function useGoToLogin(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const from = `${location.pathname}${location.search}`;
    sessionStorage.setItem(NEXT_KEY, from);
    navigate('/login', { state: { from } });
  }, [navigate, location.pathname, location.search]);
}

export function useSaved() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const goToLogin = useGoToLogin();
  const localKey = 'mm.guest-saved';
  const isAnonymous = Boolean(user?.is_anonymous);
  const key = useMemo(() => ['saved-ids', user?.id], [user?.id]);

  const query = useQuery({ queryKey: key, queryFn: fetchSavedIds, enabled: Boolean(user && !isAnonymous) });
  const [guestIds, setGuestIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(localKey) ?? '[]') as string[]; } catch { return []; }
  });
  const ids = useMemo(() => new Set(isAnonymous ? guestIds : (query.data ?? [])), [isAnonymous, guestIds, query.data]);

  const mutation = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => setSaved(id, saved),
    onMutate: async ({ id, saved }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<string[]>(key) ?? [];
      qc.setQueryData<string[]>(key, saved ? [...previous, id] : previous.filter((x) => x !== id));
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      qc.setQueryData(key, ctx?.previous ?? []);
      toast.error(err.message);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['saved-listings'] }),
  });

  const toggle = useCallback(
    (id: string) => {
      if (!user) return goToLogin();
      if (isAnonymous) {
        setGuestIds((prev) => { const next = ids.has(id) ? prev.filter((x) => x !== id) : [...prev, id]; localStorage.setItem(localKey, JSON.stringify(next)); return next; });
        return;
      }
      mutation.mutate({ id, saved: !ids.has(id) });
    },
    [user, isAnonymous, goToLogin, mutation, ids],
  );

  return { ids, toggle };
}

export function rememberRecentlyViewed(id: string): void {
  try {
    const previous = JSON.parse(localStorage.getItem('mm.recent') ?? '[]') as string[];
    localStorage.setItem('mm.recent', JSON.stringify([id, ...previous.filter((x) => x !== id)].slice(0, 12)));
  } catch { /* storage may be unavailable */ }
}

export function getRecentlyViewed(): string[] {
  try { return JSON.parse(localStorage.getItem('mm.recent') ?? '[]') as string[]; } catch { return []; }
}

/** Unread message count, kept fresh by a Realtime subscription. Call once, in the layout. */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['unread', userId],
    queryFn: () => fetchUnreadCount(userId as string),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    // Row level security means this only ever delivers messages from the member's own conversations.
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['unread'] });
        void qc.invalidateQueries({ queryKey: ['conversations'] });
        void qc.invalidateQueries({ queryKey: ['messages'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return userId ? (query.data ?? 0) : 0;
}
