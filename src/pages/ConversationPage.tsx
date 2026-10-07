import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Flag, Send, ShieldAlert } from 'lucide-react';
import { ReportDialog } from '../components/ReportDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchBlockedUsers, fetchConversation, fetchMessages, markConversationRead, sendMessage, setBlocked,
} from '../lib/api';
import { scanMessage } from '../lib/safety';
import { messageSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

export function ConversationPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [reporting, setReporting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const convo = useQuery({ queryKey: ['conversation', id], queryFn: () => fetchConversation(id), enabled: Boolean(user) });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => fetchMessages(id),
    enabled: Boolean(user),
    refetchInterval: 20_000, // safety net in case the Realtime connection drops
  });
  const blocked = useQuery({ queryKey: ['blocked', user?.id], queryFn: fetchBlockedUsers, enabled: Boolean(user) });

  const other = convo.data;
  useDocumentTitle(other ? `Chat with ${other.other_name}` : 'Chat');
  const iBlockedThem = Boolean(other && blocked.data?.some((b) => b.blocked_id === other.other_user_id));

  const lastIncoming = messages.data?.filter((m) => m.sender_id !== user?.id && !m.read_at).length ?? 0;
  useEffect(() => {
    if (!user || lastIncoming === 0) return;
    void markConversationRead(id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ['unread'] });
        void qc.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch(() => undefined);
  }, [id, user, lastIncoming, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(id, body),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: ['messages', id] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: (next: boolean) => setBlocked(other?.other_user_id as string, next),
    onSuccess: (_d, next) => {
      toast.success(next ? 'Member blocked. They can no longer message you.' : 'Member unblocked.');
      void qc.invalidateQueries({ queryKey: ['blocked'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const parsed = messageSchema.safeParse(text);
    if (!parsed.success || send.isPending) return;
    send.mutate(parsed.data);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (convo.isLoading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (!other) {
    return (
      <div className="wrap page narrow">
        <h1>Conversation not found</h1>
        <Link to="/messages">Back to messages</Link>
      </div>
    );
  }

  return (
    <div className="wrap chat-page">
      <header className="chat-head">
        <Link to="/messages" className="icon-link" aria-label="Back to messages"><ArrowLeft aria-hidden /></Link>
        <div className="chat-who">
          <h1><Link to={`/seller/${other.other_user_id}`}>{other.other_name}</Link></h1>
          {other.listing_id ? (
            <Link to={`/listing/${other.listing_id}`} className="chat-listing">{other.listing_title}</Link>
          ) : (
            <span className="chat-listing">{other.listing_title} (listing removed)</span>
          )}
        </div>
        <div className="chat-tools">
          <button type="button" className="btn btn-quiet" onClick={() => setReporting(true)}>
            <Flag aria-hidden /> Report
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => block.mutate(!iBlockedThem)} disabled={block.isPending}>
            <Ban aria-hidden /> {iBlockedThem ? 'Unblock' : 'Block'}
          </button>
        </div>
      </header>

      <p className="chat-safety">
        <ShieldAlert aria-hidden /> Do not pay before you have seen the item. Never share your M-Pesa PIN or any code. Messages are
        private between you two but are not end-to-end encrypted.
      </p>

      <div className="chat-log" role="log" aria-live="polite" aria-label="Messages">
        {messages.data?.length === 0 && <p className="muted center">Say hello and ask about the item.</p>}
        {messages.data?.map((m) => {
          const mine = m.sender_id === user?.id;
          const flags = mine ? [] : scanMessage(m.body);
          return (
            <div key={m.id} className={mine ? 'msg msg-mine' : 'msg'}>
              <p className="msg-body">{m.body}</p>
              <time className="msg-time" dateTime={m.created_at}>{clock(m.created_at)}</time>
              {flags.map((f) => (
                <p key={f.id} className="msg-flag"><ShieldAlert aria-hidden /> {f.message}</p>
              ))}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {iBlockedThem ? (
        <p className="chat-blocked">You blocked this member. Unblock them to continue the conversation.</p>
      ) : (
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="composer-text">Message</label>
          <textarea
            id="composer-text"
            rows={1}
            value={text}
            maxLength={2000}
            placeholder="Write a message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <button type="submit" className="btn btn-primary" disabled={send.isPending || !text.trim()} aria-label="Send message">
            <Send aria-hidden />
          </button>
        </form>
      )}

      <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={other.other_user_id} subject={other.other_name} />
    </div>
  );
}
