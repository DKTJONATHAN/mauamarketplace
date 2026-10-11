import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Ban, CheckCircle2, Flag, Handshake, Heart, ImagePlus, Send, ShieldAlert, X,
} from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { ListingImage } from '../components/ListingImage';
import { ReportDialog } from '../components/ReportDialog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  closeConversation, fetchBlockedUsers, fetchConversation, fetchMessageLikes, fetchMessages,
  markConversationRead, sendMessage, setBlocked, setMessageLike,
} from '../lib/api';
import { mediaUrl } from '../config/site';
import { prepareImage } from '../lib/image';
import { uploadChatImage } from '../lib/media';
import { scanMessage } from '../lib/safety';
import { messageSchema } from '../lib/validation';
import { useDocumentTitle } from '../hooks';

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

interface PendingPhoto {
  blob: Blob;
  previewUrl: string;
}

export function ConversationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const historyIndex = useRef<number | null>(typeof window !== 'undefined' && typeof window.history.state?.idx === 'number' ? window.history.state.idx : null);
  const restoringHistory = useRef(false);

  const convo = useQuery({ queryKey: ['conversation', id], queryFn: () => fetchConversation(id), enabled: Boolean(user) });
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => fetchMessages(id),
    enabled: Boolean(user),
    refetchInterval: 12_000,
  });
  const messageIds = messages.data?.map((message) => message.id) ?? [];
  const likes = useQuery({
    queryKey: ['message-likes', id, messageIds.join(',')],
    queryFn: () => fetchMessageLikes(messageIds),
    enabled: Boolean(user) && messageIds.length > 0,
    staleTime: 5_000,
  });
  const blocked = useQuery({ queryKey: ['blocked', user?.id], queryFn: fetchBlockedUsers, enabled: Boolean(user) });

  const other = convo.data;
  useDocumentTitle(other ? `Chat with ${other.other_name}` : 'Chat', true);
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
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.data?.length]);

  useEffect(() => () => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
  }, [photo?.previewUrl]);

  // Keep the existing deal-exit guard so accidentally leaving never silently deletes a chat.
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
    mutationFn: async (payload: { body: string; photo: PendingPhoto | null }) => {
      const imagePath = payload.photo ? await uploadChatImage(payload.photo.blob) : null;
      await sendMessage(id, payload.body, imagePath);
    },
    onSuccess: () => {
      setText('');
      setPhoto(null);
      void qc.invalidateQueries({ queryKey: ['messages', id] });
      void qc.invalidateQueries({ queryKey: ['message-likes', id] });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const like = useMutation({
    mutationFn: ({ messageId, next }: { messageId: string; next: boolean }) => setMessageLike(messageId, next),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['message-likes', id] }),
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

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    setPreparingPhoto(true);
    try {
      const prepared = await prepareImage(file);
      setPhoto((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return { blob: prepared.blob, previewUrl: URL.createObjectURL(prepared.blob) };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That image could not be prepared.');
    } finally {
      setPreparingPhoto(false);
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (send.isPending || preparingPhoto || (!text.trim() && !photo)) return;
    const body = text.trim();
    if (body) {
      const parsed = messageSchema.safeParse(body);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? 'Check your message.');
        return;
      }
    }
    send.mutate({ body, photo });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function requestLeave() { setDecisionOpen(true); }
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

  if (convo.isLoading) return <div className="wrap page narrow" aria-busy="true">Loading your conversation…</div>;
  if (!other) {
    return <div className="wrap page narrow"><h1>Conversation not found</h1><Link to="/messages">Back to messages</Link></div>;
  }

  return (
    <div className="wrap chat-page chat-page-modern">
      <header className="chat-head chat-head-modern">
        <button type="button" className="chat-back icon-link" aria-label="Finish chat" onClick={requestLeave}><ArrowLeft aria-hidden /></button>
        <span className="chat-avatar" aria-hidden>{other.other_name.trim().charAt(0).toUpperCase() || 'M'}</span>
        <div className="chat-who">
          <h1><Link to={`/seller/${other.other_user_id}`} onClick={(e) => { e.preventDefault(); requestLeave(); }}>{other.other_name}</Link></h1>
          <span className="chat-status"><span className="chat-status-dot" /> Maua Marketplace member</span>
          {other.listing_id ? (
            <Link to={`/listing/${other.listing_id}`} className="chat-listing" onClick={(e) => { e.preventDefault(); requestLeave(); }}>
              <span>About this listing</span> · {other.listing_title}
            </Link>
          ) : <span className="chat-listing">{other.listing_title} (listing removed)</span>}
        </div>
        <div className="chat-tools">
          <button type="button" className="btn btn-quiet chat-tool-btn" onClick={() => setReporting(true)} aria-label="Report member"><Flag aria-hidden /><span>Report</span></button>
          <button type="button" className="btn btn-quiet chat-tool-btn" onClick={() => block.mutate(!iBlockedThem)} disabled={block.isPending} aria-label={iBlockedThem ? 'Unblock member' : 'Block member'}><Ban aria-hidden /><span>{iBlockedThem ? 'Unblock' : 'Block'}</span></button>
          <button type="button" className="btn btn-tag chat-finish" onClick={requestLeave}><Handshake aria-hidden /><span>Finish chat</span></button>
        </div>
      </header>

      <div className="chat-context-card">
        {other.listing_image ? <img src={mediaUrl(other.listing_image)} alt="" /> : <span className="chat-context-placeholder"><ListingImage path={undefined} category="other" alt="" /></span>}
        <div><small>CHAT ABOUT</small><strong>{other.listing_title}</strong><span>Keep all deal details here for an easier reference.</span></div>
        {other.listing_id && <Link to={`/listing/${other.listing_id}`} aria-label="View listing" onClick={(e) => { e.preventDefault(); requestLeave(); }}>View</Link>}
      </div>

      <p className="chat-safety chat-safety-modern"><ShieldAlert aria-hidden /><span><strong>Stay safe:</strong> inspect the item in person, never share your M-Pesa PIN or verification codes, and avoid paying before you see the item. Messages are private between you two but are not end-to-end encrypted.</span></p>

      <div className="chat-log chat-log-modern" role="log" aria-live="polite" aria-label="Messages">
        {messages.isLoading && <p className="muted center">Loading messages…</p>}
        {messages.isError && <p className="field-error center" role="alert">Messages could not load. Check your connection and try again.</p>}
        {messages.data?.length === 0 && <div className="chat-empty-state"><span><Heart aria-hidden /></span><strong>Start the conversation</strong><p>Ask about the item, availability, or a good time to meet.</p></div>}
        {messages.data?.map((m) => {
          const mine = m.sender_id === user?.id;
          const flags = mine ? [] : scanMessage(m.body === '📷 Photo' ? '' : m.body);
          const messageLikes = likes.data?.filter((item) => item.message_id === m.id) ?? [];
          const likedByMe = messageLikes.some((item) => item.user_id === user?.id);
          return (
            <div key={m.id} className={mine ? 'chat-message-row is-mine' : 'chat-message-row'}>
              {!mine && <span className="chat-message-avatar" aria-hidden>{other.other_name.trim().charAt(0).toUpperCase() || 'M'}</span>}
              <div className="chat-message-content">
                <div className={mine ? 'msg msg-mine msg-modern' : 'msg msg-modern'}>
                  {m.image_path && <a className="chat-image-link" href={mediaUrl(m.image_path)} target="_blank" rel="noopener noreferrer" aria-label="Open attached photo"><img className="chat-message-image" src={mediaUrl(m.image_path)} alt="Photo attachment" loading="lazy" /></a>}
                  {m.body && m.body !== '📷 Photo' && <p className="msg-body">{m.body}</p>}
                  <div className="msg-meta"><time className="msg-time" dateTime={m.created_at}>{clock(m.created_at)}</time>{mine && <span className="chat-delivery">✓</span>}</div>
                  {flags.map((flag) => <p key={flag.id} className="msg-flag"><ShieldAlert aria-hidden /> {flag.message}</p>)}
                </div>
                <button
                  type="button"
                  className={likedByMe ? 'chat-like is-liked' : 'chat-like'}
                  aria-label={likedByMe ? 'Unlike message' : 'Like message'}
                  aria-pressed={likedByMe}
                  disabled={like.isPending}
                  onClick={() => like.mutate({ messageId: m.id, next: !likedByMe })}
                ><Heart aria-hidden fill={likedByMe ? 'currentColor' : 'none'} /><span>{messageLikes.length || 'Like'}</span></button>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {iBlockedThem ? (
        <p className="chat-blocked">You blocked this member. Unblock them to continue the conversation.</p>
      ) : (
        <form className="composer composer-modern" onSubmit={submit}>
          {photo && <div className="chat-photo-preview"><img src={photo.previewUrl} alt="Ready to send" /><span>Photo ready to send</span><button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => { URL.revokeObjectURL(photo.previewUrl); setPhoto(null); }}><X aria-hidden /></button></div>}
          <div className="chat-composer-row">
            <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void choosePhoto(e)} aria-label="Choose a photo to attach" />
            <button type="button" className="chat-attach btn btn-quiet" onClick={() => fileInput.current?.click()} disabled={send.isPending || preparingPhoto} aria-label="Attach image"><ImagePlus aria-hidden /></button>
            <label className="sr-only" htmlFor="composer-text">Message</label>
            <textarea id="composer-text" rows={1} value={text} maxLength={2000} placeholder="Write a message…" onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
            <button type="submit" className="btn btn-primary chat-send" disabled={send.isPending || preparingPhoto || (!text.trim() && !photo)} aria-label="Send message">
              <Send aria-hidden /><span>{preparingPhoto ? 'Preparing…' : send.isPending ? 'Sending…' : 'Send'}</span>
            </button>
          </div>
          <div className="chat-composer-hint"><span>Enter to send · Shift + Enter for a new line</span><span>{text.length}/2000</span></div>
        </form>
      )}

      <Dialog open={decisionOpen} onClose={() => setDecisionOpen(false)} title="What do you want to do with this deal?">
        <div className="chat-decision">
          <p>Before you leave this conversation, choose one option. This decision controls whether the chat remains available.</p>
          <div className="chat-decision-option">
            <h3>Close the deal &amp; close the chat</h3>
            <p>The deal is finished. The entire conversation and its messages will be permanently deleted for both people.</p>
            <button type="button" className="btn btn-danger-solid btn-block" onClick={confirmCloseChat} disabled={closing}><CheckCircle2 aria-hidden /> {closing ? 'Closing chat…' : 'Close deal & delete chat'}</button>
          </div>
          <div className="chat-decision-option">
            <h3>Keep the chat &amp; close the deal later</h3>
            <p>The conversation stays in your Chats so you can continue discussing the deal later.</p>
            <button type="button" className="btn btn-primary btn-block" onClick={keepChatAndLeave}>Keep chat &amp; leave</button>
          </div>
        </div>
      </Dialog>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={other.other_user_id} subject={other.other_name} />
    </div>
  );
}
