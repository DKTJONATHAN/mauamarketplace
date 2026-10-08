import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Flag, Handshake, Send, ShieldAlert } from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { ReportDialog } from '../components/ReportDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  closeConversation, fetchBlockedUsers, fetchConversation, fetchMessages, markConversationRead, sendMessage, setBlocked,
} from '../lib/api';
import { scanMessage } from '../lib/safety';
import { messageSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

export function ConversationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const historyIndex = useRef<number | null>(typeof window !== 'undefined' && typeof window.history.state?.idx === 'number' ? window.history.state.idx : null);
  const restoringHistory = useRef(false);

  const convo = useQuery({ queryKey: ['conversation', id], queryFn: () => fetchConversation(id), enabled: Boolean(user) });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => fetchMessages(id),
    enabled: Boolean(user),
    refetchInterval: 20_000,
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

  // The app uses HashRouter, so this explicit guard covers all in-app links while
  // this conversation is open and also restores browser back/forward navigation.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const href = target.getAttribute('href') ?? '';
      if (!href.startsWith('#/') || href === window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setDecisionOpen(true);
    };

    const onPopState = (event: PopStateEvent) => {
      if (leaving.current || restoringHistory.current) {
        if (restoringHistory.current) restoringHistory.current = false;
        return;
      }
      const nextIndex = typeof event.state?.idx === 'number' ? event.state.idx : null;
      const currentIndex = historyIndex.current;
      if (nextIndex === null || currentIndex === null || nextIndex === currentIndex) return;
      const delta = nextIndex - currentIndex;
      restoringHistory.current = true;
      event.stopImmediatePropagation();
      window.history.go(-delta);
      setDecisionOpen(true);
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

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

  const closeChat = useMutation({
    mutationFn: () => closeConversation(id),
    onSuccess: () => {
      leaving.current = true;
      setDecisionOpen(false);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['unread'] });
      toast.success('Deal closed. This chat has been permanently closed.');
      navigate('/messages', { replace: true });
    },
    onError: (e: Error) => {
      setClosing(false);
      toast.error(e.message);
    },
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

  function requestLeave() {
    setDecisionOpen(true);
  }

  function keepChatAndLeave() {
    leaving.current = true;
    setDecisionOpen(false);
    navigate('/messages');
  }

  function confirmCloseChat() {
    if (closeChat.isPending) return;
    setClosing(true);
    closeChat.mutate();
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
        <button type="button" className="icon-link" aria-label="Finish chat" onClick={requestLeave}>
          <ArrowLeft aria-hidden />
        </button>
        <div className="chat-who">
          <h1><Link to={`/seller/${other.other_user_id}`} onClick={(e) => { e.preventDefault(); requestLeave(); }}>{other.other_name}</Link></h1>
          {other.listing_id ? (
            <Link to={`/listing/${other.listing_id}`} className="chat-listing" onClick={(e) => { e.preventDefault(); requestLeave(); }}>{other.listing_title}</Link>
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
          <button type="button" className="btn btn-tag chat-finish" onClick={requestLeave}>
            <Handshake aria-hidden /> Finish chat
          </button>
        </div>
      </header>

      <p className="chat-lock-note">
        <ShieldAlert aria-hidden />
        <span>Keep this chat open while you discuss the deal. When you are ready to leave, choose whether to close the deal and chat or keep the conversation for later.</span>
      </p>

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

      <Dialog open={decisionOpen} onClose={() => setDecisionOpen(false)} title="What do you want to do with this deal?">
        <div className="chat-decision">
          <p>Before you leave this conversation, choose one option. This decision controls whether the chat remains available.</p>
          <div className="chat-decision-option">
            <h3>Close the deal & close the chat</h3>
            <p>The deal is finished. The entire conversation and its messages will be permanently deleted for both people.</p>
            <button type="button" className="btn btn-danger-solid btn-block" onClick={confirmCloseChat} disabled={closing}>
              <CheckCircle2 aria-hidden /> {closing ? 'Closing chat...' : 'Close deal & delete chat'}
            </button>
          </div>
          <div className="chat-decision-option">
            <h3>Keep the chat & close the deal later</h3>
            <p>The conversation stays in your Chats so you can continue discussing the deal later.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={keepChatAndLeave}>
              Keep chat & leave
            </button>
          </div>
        </div>
      </Dialog>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={other.other_user_id} subject={other.other_name} />
    </div>
  );
}
