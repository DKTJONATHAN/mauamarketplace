import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { site } from './config/site';
import { useAuth, NEXT_KEY } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { fetchSavedIds, fetchUnreadCount, setSaved } from './lib/api';
import { supabase } from './lib/supabase';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} - ${site.name}` : `${site.name} - buy and sell in ${site.place}`;
  }, [title]);
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
  const key = useMemo(() => ['saved-ids', user?.id], [user?.id]);

  const query = useQuery({ queryKey: key, queryFn: fetchSavedIds, enabled: Boolean(user) });
  const ids = useMemo(() => new Set(query.data ?? []), [query.data]);

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
      mutation.mutate({ id, saved: !ids.has(id) });
    },
    [user, goToLogin, mutation, ids],
  );

  return { ids, toggle };
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
